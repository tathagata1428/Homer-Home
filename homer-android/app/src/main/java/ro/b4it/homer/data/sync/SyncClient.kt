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
import java.time.Instant
import java.util.concurrent.atomic.AtomicLong
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

/**
 * Thin HTTP client that talks directly to Supabase REST API (Option A).
 *
 * No CF Pages hop, no resolveSupabaseOwnerId() lookup.
 * Signs in with email+password via Supabase Auth to get access_token + user_id,
 * then uses them for all field_state REST calls.
 *
 * GET  /rest/v1/field_state?user_id=eq.{uid}&select=field_id,value
 * POST /rest/v1/field_state?on_conflict=user_id,field_id  (upsert)
 */
@Singleton
class SyncClient @Inject constructor(
    private val okHttp: OkHttpClient,
    @Named("supabaseUrl")     private val supabaseUrl: String,
    @Named("supabaseAnonKey") private val anonKey: String,
    @Named("syncEmail")       private val syncEmail: String,
    @Named("syncPassword")    private val syncPassword: String,
) {
    private val seq          = AtomicLong(0L)
    private val lastClientTs = AtomicLong(0L)
    private val json         = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    // Cached Supabase session — protected by authMutex
    private val authMutex     = Mutex()
    private var accessToken   : String? = null
    private var userId        : String? = null
    private var tokenExpiresAt: Long    = 0L

    fun isConfigured(): Boolean =
        BuildConfig.SYNC_ENABLED &&
        supabaseUrl.isNotBlank() && anonKey.isNotBlank() && syncEmail.isNotBlank() && syncPassword.isNotBlank()

    // ── Auth ──────────────────────────────────────────────────────────────────

    private suspend fun ensureSession() = authMutex.withLock {
        val now = System.currentTimeMillis()
        if (accessToken != null && now < tokenExpiresAt - 60_000L) return@withLock

        Log.d("SyncClient", "Signing in to Supabase as $syncEmail …")
        val bodyStr = buildJsonObject {
            put("email", syncEmail)
            put("password", syncPassword)
        }.toString()
        val req = Request.Builder()
            .url("$supabaseUrl/auth/v1/token?grant_type=password")
            .addHeader("apikey", anonKey)
            .addHeader("Content-Type", "application/json")
            .post(bodyStr.toRequestBody("application/json".toMediaType()))
            .build()
        val raw = okHttp.newCall(req).execute().use { r ->
            if (!r.isSuccessful) throw Exception("Supabase auth failed: HTTP ${r.code} ${r.body?.string()}")
            r.body?.string() ?: throw Exception("Supabase auth: empty response body")
        }
        val root      = json.parseToJsonElement(raw).jsonObject
        accessToken   = root["access_token"]?.jsonPrimitive?.content
            ?: throw Exception("Supabase auth: no access_token in response")
        userId        = root["user"]?.jsonObject?.get("id")?.jsonPrimitive?.content
            ?: throw Exception("Supabase auth: no user.id in response")
        val expiresIn = root["expires_in"]?.jsonPrimitive?.long ?: 3600L
        tokenExpiresAt = now + expiresIn * 1000L
        Log.d("SyncClient", "Supabase session ok — uid=$userId expires_in=${expiresIn}s")
    }

    // ── Session info (for Realtime) ───────────────────────────────────────────

    /** Returns (accessToken, userId) after ensuring a valid session. Used by RealtimeSyncManager. */
    suspend fun getSessionInfo(): Pair<String, String> {
        ensureSession()
        return Pair(
            checkNotNull(accessToken) { "No Supabase access token" },
            checkNotNull(userId)      { "No Supabase user ID" },
        )
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /** Fetch all field values in a single HTTP call. Returns fieldId → raw value string. */
    suspend fun getAllFields(): Map<String, String> = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext emptyMap()
        ensureSession()
        val req = Request.Builder()
            .url("$supabaseUrl/rest/v1/field_state?user_id=eq.$userId&select=field_id,value")
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("apikey", anonKey)
            .get()
            .build()
        val body = okHttp.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) {
                Log.w("SyncClient", "getAllFields: HTTP ${resp.code} ${resp.body?.string()}")
                return@withContext emptyMap()
            }
            resp.body?.string() ?: return@withContext emptyMap()
        }
        val arr = runCatching { json.parseToJsonElement(body).jsonArray }.getOrNull()
            ?: return@withContext emptyMap()
        buildMap {
            for (el in arr) {
                val obj     = el.jsonObject
                val fieldId = obj["field_id"]?.jsonPrimitive?.contentOrNull ?: continue
                // value column may be TEXT (JsonPrimitive) or JSONB (JsonObject/JsonArray)
                val value   = when (val v = obj["value"]) {
                    is JsonPrimitive -> v.contentOrNull ?: continue
                    null             -> continue
                    else             -> v.toString()
                }
                put(fieldId, value)
            }
        }.also { Log.d("SyncClient", "getAllFields: ${it.size} fields") }
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /** Push a single field value directly to Supabase field_state (upsert). */
    suspend fun pushField(fieldId: String, value: String) = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext
        ensureSession()
        val rawTs  = System.currentTimeMillis()
        val ts     = lastClientTs.updateAndGet { prev -> maxOf(rawTs, prev + 1) }
        val s      = seq.getAndIncrement()
        val bodyStr = buildJsonArray {
            addJsonObject {
                put("user_id",    userId!!)
                put("field_id",   fieldId)
                put("value",      value)
                put("client_ts",  ts)
                put("client_seq", s)
                put("updated_at", Instant.now().toString())
            }
        }.toString()
        val req = Request.Builder()
            .url("$supabaseUrl/rest/v1/field_state?on_conflict=user_id,field_id")
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("apikey", anonKey)
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "resolution=merge-duplicates,return=minimal")
            .post(bodyStr.toRequestBody("application/json".toMediaType()))
            .build()
        okHttp.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) {
                val err = resp.body?.string()
                Log.w("SyncClient", "pushField[$fieldId]: HTTP ${resp.code} $err")
                throw Exception("pushField HTTP ${resp.code}")
            }
            Log.d("SyncClient", "pushField[$fieldId]: ok")
        }
    }
}
