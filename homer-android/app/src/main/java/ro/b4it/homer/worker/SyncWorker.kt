package ro.b4it.homer.worker

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.*
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import ro.b4it.homer.data.sync.SyncEngine
import java.util.concurrent.TimeUnit

/**
 * Periodic background sync — pulls all Supabase field_state rows into Room every 15 minutes
 * when the device is connected to the network and the user is Bogdan.
 *
 * Uses Hilt-assisted injection so SyncEngine is available without a manual factory.
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val sync: SyncEngine,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        Log.d(TAG, "Background sync started (attempt $runAttemptCount)")
        return try {
            // Background worker only pulls. Pushes happen via debounced mutation hooks
            // or the explicit "Sync Now" button — never in background, to prevent stale
            // Android data from overwriting newer website changes.
            sync.pullAll()
            Log.d(TAG, "Background sync completed")
            Result.success()
        } catch (e: Exception) {
            Log.w(TAG, "Background sync failed: ${e.message}")
            if (runAttemptCount < MAX_RETRIES) Result.retry() else Result.failure()
        }
    }

    companion object {
        private const val TAG          = "SyncWorker"
        private const val MAX_RETRIES  = 3
        const val WORK_NAME            = "homer_periodic_sync"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 2, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
            Log.d(TAG, "Periodic sync scheduled (15 min interval)")
        }
    }
}
