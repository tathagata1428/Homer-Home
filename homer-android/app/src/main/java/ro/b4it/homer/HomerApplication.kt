package ro.b4it.homer

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class HomerApplication : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)

            nm.createNotificationChannel(NotificationChannel(
                CHANNEL_POMODORO,
                getString(R.string.pomodoro_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply { description = getString(R.string.pomodoro_channel_desc) })

            nm.createNotificationChannel(NotificationChannel(
                CHANNEL_AMBIENT,
                getString(R.string.ambient_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply { description = getString(R.string.ambient_channel_desc) })

            nm.createNotificationChannel(NotificationChannel(
                CHANNEL_SYNC,
                getString(R.string.sync_channel_name),
                NotificationManager.IMPORTANCE_MIN
            ).apply { description = getString(R.string.sync_channel_desc) })
        }
    }

    companion object {
        const val CHANNEL_POMODORO = "homer_pomodoro"
        const val CHANNEL_AMBIENT  = "homer_ambient"
        const val CHANNEL_SYNC     = "homer_sync"
    }
}
