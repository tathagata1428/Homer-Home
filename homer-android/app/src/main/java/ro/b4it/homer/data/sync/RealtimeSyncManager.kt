package ro.b4it.homer.data.sync

import android.util.Log
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import ro.b4it.homer.data.supabase.SupabaseManager
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Subscribes to Supabase Realtime so that field_state changes made on the website
 * are applied to Room immediately — without waiting for the next scheduled pull.
 *
 * Only active for Bogdan. Non-Bogdan users stay in local-only mode.
 */
@Singleton
class RealtimeSyncManager @Inject constructor(
    private val supabase: SupabaseManager,
    private val sync: SyncEngine,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    @Volatile private var subscribed = false

    fun start() {
        if (subscribed) return
        if (!supabase.isBogdan()) return
        subscribed = true
        scope.launch {
            try {
                val userId = supabase.userId ?: run {
                    subscribed = false; return@launch
                }
                supabase.client.realtime.connect()
                val channel = supabase.client.channel("homer_field_state_$userId")
                val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                    table = "field_state"
                }
                flow.onEach { action ->
                    when (action) {
                        is PostgresAction.Insert, is PostgresAction.Update -> {
                            val record  = action.record
                            val fieldId = record["field_id"]?.jsonPrimitive?.content ?: return@onEach
                            val rowUser = record["user_id"]?.jsonPrimitive?.content ?: return@onEach
                            // Client-side filter: only process rows that belong to this user
                            if (rowUser != userId) return@onEach
                            Log.d(TAG, "Realtime: field updated → $fieldId")
                            sync.applyFieldUpdate(fieldId)
                        }
                        else -> Unit
                    }
                }.launchIn(scope)
                channel.subscribe()
                Log.d(TAG, "Subscribed to field_state realtime (userId=$userId)")
            } catch (e: Exception) {
                Log.e(TAG, "Realtime subscription failed: ${e.message}")
                subscribed = false
            }
        }
    }

    fun stop() {
        subscribed = false
        scope.launch {
            runCatching { supabase.client.realtime.disconnect() }
        }
    }

    private companion object {
        const val TAG = "HomerRealtime"
    }
}
