package ro.b4it.homer.data.sync

import android.util.Log
import ro.b4it.homer.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.atomic.AtomicLong
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

/**
 * Thin HTTP client for the Homer website API (self-hosted Postgres behind it).
 *
 * Signs in with the Homer username + password (POST /api/auth exchangeToken)
 * to get an access token, then reads/writes field_state through /api/db.
 * The server pins every query to the signed-in account.
 *
 * POST /api/db { table: "field_state", op: "select", columns: "field_id,value" }
 * POST /api/db { table: "field_state", op: "upsert", onConflict: "user_id,field_id", values: [...] }
 * POST /api/db { op: "changes", since: { field_state: "<iso>" } }
 */
@Singleton
class SyncClient @Inject constructor(
    private val okHttp: OkHttpClient,
    @Named("homerBaseUrl") private val baseUrl: String,
    @Named("syncUsername") private val syncUsername: String,
    @Named("syncPassword") private val syncPassword: String,
) {
    private val seq          = AtomicLong(0L)
    private val lastClientTs = AtomicLong(0L)
    private val json         = Json { ignoreUnknownKeys = true; coerceInputValues = true }
    private val jsonType     = "application/json".toMediaType()

    // Cached session — protected by authMutex
    private val authMutex     = Mutex()
    private var accessToken   : String? = null
    private var tokenExpiresAt: Long    = 0L

    fun isConfigured(): Boolean =
        BuildConfig.SYNC_ENABLED &&
        baseUrl.isNotBlank() && syncUsername.isNotBlank() && syncPassword.isNotBlank()

    // ── Auth ──────────────────────────────────────────────────────────────────

    private suspend fun ensureSession() = authMutex.withLock {
        val now = System.currentTimeMillis()
        if (accessToken != null && now < tokenExpiresAt - 60_000L) return@withLock

        Log.d("SyncClient", "Signing in to Homer as $syncUsername …")
        val bodyStr = buildJsonObject {
            put("action", "exchangeToken")
            put("username", syncUsername)
            put("password", syncPassword)
        }.toString()
        val req = Request.Builder()
            .url("$baseUrl/api/auth")
            .post(bodyStr.toRequestBody(jsonType))
            .build()
        val raw = okHttp.newCall(req).execute().use { r ->
            if (!r.isSuccessful) throw Exception("Homer auth failed: HTTP ${r.code} ${r.body?.string()}")
            r.body?.string() ?: throw Exception("Homer auth: empty response body")
        }
        val root      = json.parseToJsonElement(raw).jsonObject
        accessToken   = root["access_token"]?.jsonPrimitive?.content
            ?: throw Exception("Homer auth: no access_token in response")
        val expiresIn = root["expires_in"]?.jsonPrimitive?.long ?: 3600L
        tokenExpiresAt = now + expiresIn * 1000L
        Log.d("SyncClient", "Homer session ok — expires_in=${expiresIn}s")
    }

    /** POST a body to /api/db. Retries once with a fresh token on 401. */
    private suspend fun dbCall(body: JsonObject): JsonObject {
        ensureSession()
        repeat(2) { attempt ->
            val req = Request.Builder()
                .url("$baseUrl/api/db")
                .addHeader("Authorization", "Bearer $accessToken")
                .post(body.toString().toRequestBody(jsonType))
                .build()
            okHttp.newCall(req).execute().use { resp ->
                val text = resp.body?.string().orEmpty()
                if (resp.code == 401 && attempt == 0) {
                    authMutex.withLock { accessToken = null }
                    ensureSession()
                    return@repeat
                }
                if (!resp.isSuccessful) throw Exception("/api/db HTTP ${resp.code} $text")
                val obj = json.parseToJsonElement(text).jsonObject
                val err = obj["error"]
                if (err != null && err !is JsonNull) throw Exception("/api/db error: $err")
                return obj
            }
        }
        throw Exception("/api/db: unauthorized after re-login")
    }

    /** field_state.value is TEXT, but tolerate JSON values too. */
    private fun valueOf(el: JsonElement?): String? = when (el) {
        is JsonPrimitive -> el.contentOrNull
        null, JsonNull   -> null
        else             -> el.toString()
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /** Fetch all field values in a single HTTP call. Returns fieldId → raw value string. */
    suspend fun getAllFields(): Map<String, String> = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext emptyMap()
        val res = runCatching {
            dbCall(buildJsonObject {
                put("table", "field_state")
                put("op", "select")
                put("columns", "field_id,value")
            })
        }.getOrElse {
            Log.w("SyncClient", "getAllFields failed: ${it.message}")
            return@withContext emptyMap()
        }
        val arr = res["data"] as? JsonArray ?: return@withContext emptyMap()
        buildMap {
            for (el in arr) {
                val obj     = el.jsonObject
                val fieldId = obj["field_id"]?.jsonPrimitive?.contentOrNull ?: continue
                val value   = valueOf(obj["value"]) ?: continue
                put(fieldId, value)
            }
        }.also { Log.d("SyncClient", "getAllFields: ${it.size} fields") }
    }

    /**
     * Rows changed since [since] (server ISO timestamp; null = just fetch a cursor).
     * Returns the new cursor and the changed (fieldId, value, deviceId) rows.
     */
    suspend fun pollChanges(since: String?): Pair<String, List<Triple<String, String, String>>> =
        withContext(Dispatchers.IO) {
            val res = dbCall(buildJsonObject {
                put("op", "changes")
                putJsonObject("since") { put("field_state", since) }
            })
            val now  = res["now"]?.jsonPrimitive?.contentOrNull ?: throw Exception("changes: no cursor")
            val rows = (res["changes"]?.jsonObject?.get("field_state") as? JsonArray).orEmpty()
            val changes = rows.mapNotNull { el ->
                val obj     = el.jsonObject
                val fieldId = obj["field_id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                val value   = valueOf(obj["value"]) ?: return@mapNotNull null
                val device  = obj["device_id"]?.jsonPrimitive?.contentOrNull.orEmpty()
                Triple(fieldId, value, device)
            }
            Pair(now, changes)
        }

    // ── Write ─────────────────────────────────────────────────────────────────

    /** Push a single field value to field_state (upsert). */
    suspend fun pushField(fieldId: String, value: String) = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext
        val rawTs = System.currentTimeMillis()
        val ts    = lastClientTs.updateAndGet { prev -> maxOf(rawTs, prev + 1) }
        val s     = seq.getAndIncrement()
        try {
            dbCall(buildJsonObject {
                put("table", "field_state")
                put("op", "upsert")
                put("onConflict", "user_id,field_id")
                putJsonArray("values") {
                    addJsonObject {
                        put("field_id",   fieldId)
                        put("value",      value)
                        put("client_ts",  ts)
                        put("client_seq", s)
                        put("server_ts",  ts)
                        put("device_id",  DEVICE_ID)
                    }
                }
            })
            Log.d("SyncClient", "pushField[$fieldId]: ok")
        } catch (e: Exception) {
            Log.w("SyncClient", "pushField[$fieldId]: ${e.message}")
            throw Exception("pushField failed: ${e.message}")
        }
    }

    companion object {
        /** Written to field_state.device_id so the poller can skip our own echoes. */
        const val DEVICE_ID = "android"
    }
}
