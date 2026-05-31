package ro.b4it.homer

import android.app.Activity
import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Bundle
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import ro.b4it.homer.data.sync.SyncEngine
import ro.b4it.homer.notification.ReminderManager
import ro.b4it.homer.worker.SyncWorker
import javax.inject.Inject

@HiltAndroidApp
class HomerApplication : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory
    @Inject lateinit var reminderManager: ReminderManager
    @Inject lateinit var syncEngine: SyncEngine

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        reminderManager.scheduleAll()
        // Start sync: pull all fields on launch; periodic 15-min push via SyncWorker.
        syncEngine.start()
        SyncWorker.schedule(this)
        // Register a one-shot network callback so that if the initial pull failed
        // (device was offline at boot / WiFi not yet reconnected), we retry as soon
        // as the device has a working internet connection rather than waiting 15 min.
        scheduleNetworkRetryPull()
        // Pull fresh data whenever the user brings the app to the foreground (2-min debounce).
        // This ensures website changes appear promptly without waiting 15 min for SyncWorker.
        registerForegroundSyncObserver()
    }

    /**
     * Register an activity lifecycle observer that calls [SyncEngine.onForeground] every time
     * any activity is resumed. SyncEngine.onForeground() debounces to at most one pull per
     * 2 minutes, so this is safe to register globally without flooding the server.
     */
    private fun registerForegroundSyncObserver() {
        registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) { syncEngine.onForeground() }
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityStarted(activity: Activity) {}
            override fun onActivityPaused(activity: Activity) {}
            override fun onActivityStopped(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })
    }

    /**
     * Register a one-shot ConnectivityManager callback that fires [SyncEngine.pullAll] once
     * as soon as the device has a working internet connection. Used when the startup pull
     * fails because WiFi hasn't reconnected yet after the screen was off.
     */
    private fun scheduleNetworkRetryPull() {
        val cm = getSystemService(ConnectivityManager::class.java) ?: return
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                cm.unregisterNetworkCallback(this)
                appScope.launch {
                    runCatching { syncEngine.pullAll() }
                }
            }
        }
        runCatching { cm.registerNetworkCallback(request, cb) }
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

            nm.createNotificationChannel(NotificationChannel(
                CHANNEL_REMINDERS,
                "Reminders & Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Calendar events, due dates, and scheduled reminders"
                enableLights(true)
                enableVibration(true)
            })
        }
    }

    companion object {
        const val CHANNEL_POMODORO  = "homer_pomodoro"
        const val CHANNEL_AMBIENT   = "homer_ambient"
        const val CHANNEL_SYNC      = "homer_sync"
        const val CHANNEL_REMINDERS = "homer_reminders"
    }
}
