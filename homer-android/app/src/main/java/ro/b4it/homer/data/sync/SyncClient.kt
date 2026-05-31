package ro.b4it.homer.data.sync

import android.util.Log
import kotlinx.coroutines.Dispatchers
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
 * Thin HTTP client that talks to the CF Pages /api/sync endpoint.
 *
 * All sync data lives in Supabase field_state but Android never touches Supabase directly —
 * it goes through the CF edge function using the admin hash for auth.
 *
 * GET  /api/sync?action=field-state&key=HASH  → { state: { fieldId: { value, ... } } }
 * POST /api/sync  { action:"field-op", key:HASH, ops:[...] }  → upsert fields
 */
@Singleton
class SyncClient @Inject constructor(
    private val okHttp: OkHttpClient,
    @Named("homerBaseUrl") private val baseUrl: String,
    @Named("adminHash")    private val adminHash: String,
) {
    private val seq = AtomicLong(0L)
    /**
     * Monotonically-increasing clientTs.
     * The server rejects any push where incomingClientTs < existingClientTs.
     * NTP corrections can move System.currentTimeMillis() backward, causing
     * every subsequent push to be silently dropped as "stale".
     * Using updateAndGet(max(now, prev+1)) guarantees we never go backward.
     */
    private val lastClientTs = AtomicLong(0L)
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    fun isConfigured(): Boolean = adminHash.isNotBlank()

    /** Fetch all field values in a single HTTP call. Returns fieldId → raw value string. */
    suspend fun getAllFields(): Map<String, String> = withContext(Dispatchers.IO) {
        val url = "$baseUrl/api/sync?action=field-state&key=$adminHash"
        val req = Request.Builder().url(url).get().build()
        val body = okHttp.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) {
                Log.w("SyncClient", "getAllFields: HTTP ${resp.code}")
                return@withContext emptyMap()
            }
            resp.body?.string() ?: return@withContext emptyMap()
        }
        val root = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull()
            ?: return@withContext emptyMap()
        val state = root["state"]?.jsonObject ?: return@withContext emptyMap()
        buildMap {
            for ((fieldId, entry) in state) {
                val value = entry.jsonObject["value"]?.jsonPrimitive?.contentOrNull ?: continue
                put(fieldId, value)
            }
        }.also { Log.d("SyncClient", "getAllFields: ${it.size} fields") }
    }

    /** Push a single field value to the cloud. */
    suspend fun pushField(fieldId: String, value: String) = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext
        val rawTs = System.currentTimeMillis()
        val ts = lastClientTs.updateAndGet { prev -> maxOf(rawTs, prev + 1) }
        val s   = seq.getAndIncrement()
        val body = buildJsonObject {
            put("action",   "field-op")
            put("key",      adminHash)
            put("deviceId", "android")
            putJsonArray("ops") {
                addJsonObject {
                    put("fieldId",   fieldId)
                    put("kind",      "json")
                    put("value",     value)
                    put("clientTs",  ts)
                    put("clientSeq", s)
                }
            }
        }.toString()
        val req = Request.Builder()
            .url("$baseUrl/api/sync")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()
        okHttp.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful)
                Log.w("SyncClient", "pushField[$fieldId]: HTTP ${resp.code}")
            else
                Log.d("SyncClient", "pushField[$fieldId]: ok")
        }
    }
}
