package ro.b4it.homer.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import ro.b4it.homer.data.sync.SyncEngine

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val sync: SyncEngine,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        runCatching { sync.pullAll() }
        return Result.success()
    }

    companion object {
        const val UNIQUE_NAME = "homer_hourly_sync"
    }
}
