package ro.b4it.homer.data.sync

import android.util.Log
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import okhttp3.*
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

/**
 * Supabase Realtime subscription via WebSocket (Phoenix protocol).
 *
 * Subscribes to INSERT/UPDATE on `field_state` for the sync user.
 * On any change, delegates to [SyncEngine.applyFieldUpdate] so Room entities
 * update instantly — no waiting for the 15-min SyncWorker or next foreground pull.
 *
 * Protocol:
 *  - WebSocket URL: wss://PROJECT.supabase.co/realtime/v1/websocket?vsn=1.0.0&apikey=ANON_KEY
 *  - Phoenix messages: JSON arrays [join_ref, ref, topic, event, payload]
 *  - Heartbeat every 30 s keeps the connection alive through NAT / proxies
 *  - Auto-reconnect with 5 s delay on failure or unexpected close
 */
@Singleton
class RealtimeSyncManager @Inject constructor(
    private val syncClient: SyncClient,
    private val syncEngine: SyncEngine,
    private val okHttp: OkHttpClient,
    @Named("supabaseUrl")     private val supabaseUrl: String,
    @Named("supabaseAnonKey") private val anonKey: String,
) {
    private val scope         = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json          = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    @Volatile private var ws             : WebSocket? = null
    @Volatile private var heartbeatJob   : Job?       = null
    @Volatile private var reconnectJob   : Job?       = null
    @Volatile private var running        : Boolean    = false

    fun start() {
        if (!syncClient.isConfigured()) return
        running = true
        scope.launch { connect() }
    }

    fun stop() {
        running = false
        ws?.close(1000, "stop")
        ws = null
        heartbeatJob?.cancel()
        reconnectJob?.cancel()
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    private suspend fun connect() {
        val (token, userId) = runCatching { syncClient.getSessionInfo() }.getOrElse {
            Log.w("HomerRealtime", "Could not get session — Realtime not started", it)
            scheduleReconnect(); return
        }

        val wsUrl = supabaseUrl
            .replace("https://", "wss://")
            .replace("http://",  "ws://") +
            "/realtime/v1/websocket?vsn=1.0.0&apikey=$anonKey"

        val request = Request.Builder().url(wsUrl).build()
        ws = okHttp.newWebSocket(request, object : WebSocketListener() {

            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d("HomerRealtime", "Connected to Supabase Realtime")
                val joinMsg = buildJsonArray {
                    add("1"); add("1")
                    add("realtime:public:field_state")
                    add("phx_join")
                    addJsonObject {
                        putJsonObject("config") {
                            putJsonObject("broadcast") { put("ack", false); put("self", false) }
                            putJsonObject("presence")  { put("key", "") }
                            putJsonArray("postgres_changes") {
                                addJsonObject {
                                    put("event",  "*")
                                    put("schema", "public")
                                    put("table",  "field_state")
                                    put("filter", "user_id=eq.$userId")
                                }
                            }
                        }
                        put("access_token", token)
                    }
                }.toString()
                webSocket.send(joinMsg)
                startHeartbeat(webSocket)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.w("HomerRealtime", "WebSocket error: ${t.message}")
                cleanup(); scheduleReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d("HomerRealtime", "WebSocket closed: $code $reason")
                cleanup()
                if (code != 1000) scheduleReconnect()
            }
        })
    }

    private fun handleMessage(text: String) {
        val arr = runCatching { json.parseToJsonElement(text).jsonArray }.getOrNull() ?: return
        if (arr.size < 5) return
        val event = arr[3].jsonPrimitive.contentOrNull ?: return
        if (event != "postgres_changes") return

        val payload = arr[4].jsonObject
        val data    = payload["data"]?.jsonObject ?: return
        val record  = data["record"]?.jsonObject  ?: return

        val fieldId = record["field_id"]?.jsonPrimitive?.contentOrNull ?: return
        val value   = when (val v = record["value"]) {
            is JsonPrimitive -> v.contentOrNull ?: return
            null             -> return
            else             -> v.toString()
        }
        Log.d("HomerRealtime", "Realtime update: $fieldId")
        scope.launch { runCatching { syncEngine.applyFieldUpdate(fieldId, value) } }
    }

    private fun startHeartbeat(webSocket: WebSocket) {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            var ref = 2
            while (isActive) {
                delay(30_000)
                val hb = buildJsonArray {
                    add(JsonNull); add(ref.toString())
                    add("phoenix"); add("heartbeat")
                    addJsonObject {}
                }.toString()
                webSocket.send(hb)
                ref++
            }
        }
    }

    private fun scheduleReconnect() {
        if (!running) return
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(5_000)
            if (running) connect()
        }
    }

    private fun cleanup() {
        ws = null
        heartbeatJob?.cancel()
        heartbeatJob = null
    }
}
