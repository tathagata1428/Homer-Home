package ro.b4it.homer.data.sync

import android.util.Log
import kotlinx.coroutines.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Polls the Homer API for field_state rows changed by other devices
 * (replaces the Supabase Realtime WebSocket).
 *
 * Runs every [POLL_MS] while an activity is visible; in the background the
 * 15-min SyncWorker covers it. Each changed field goes to
 * [SyncEngine.applyFieldUpdate] so Room entities update right away.
 */
@Singleton
class FieldChangePoller @Inject constructor(
    private val syncClient: SyncClient,
    private val syncEngine: SyncEngine,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Volatile private var job    : Job?    = null
    @Volatile private var cursor : String? = null
    // Rows near the cursor come back on the next poll too; skip ones already applied.
    private val applied = LinkedHashMap<String, String>()

    /** Call with true when the app comes to the foreground, false when it leaves. */
    fun setForeground(foreground: Boolean) {
        if (!syncClient.isConfigured()) return
        if (!foreground) { job?.cancel(); job = null; return }
        if (job?.isActive == true) return
        job = scope.launch {
            while (isActive) {
                runCatching { pollOnce() }.onFailure { Log.w("HomerPoll", "poll failed: ${it.message}") }
                delay(POLL_MS)
            }
        }
    }

    private suspend fun pollOnce() {
        val (next, changes) = syncClient.pollChanges(cursor)
        val first = cursor == null
        cursor = next
        if (first) return // first call only establishes the cursor
        for ((fieldId, value, deviceId) in changes) {
            if (deviceId == SyncClient.DEVICE_ID) continue
            if (applied[fieldId] == value) continue
            applied[fieldId] = value
            if (applied.size > 500) applied.remove(applied.keys.first())
            Log.d("HomerPoll", "remote update: $fieldId")
            runCatching { syncEngine.applyFieldUpdate(fieldId, value) }
        }
    }

    companion object {
        private const val POLL_MS = 10_000L
    }
}
