package ro.b4it.homer

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.HiltAndroidApp
import ro.b4it.homer.worker.SyncWorker
import java.util.concurrent.TimeUnit
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import ro.b4it.homer.BuildConfig
import ro.b4it.homer.data.preferences.AppPreferences
import ro.b4it.homer.data.supabase.SupabaseManager
import ro.b4it.homer.data.sync.SyncEngine
import ro.b4it.homer.notification.ReminderManager
import javax.inject.Inject

@HiltAndroidApp
class HomerApplication : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory
    @Inject lateinit var reminderManager: ReminderManager
    @Inject lateinit var supabase: SupabaseManager
    @Inject lateinit var syncEngine: SyncEngine
    @Inject lateinit var prefs: AppPreferences

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        reminderManager.scheduleAll()
        scheduleHourlySync()
        initSupabaseSync()
    }

    /**
     * Auto sign-in to Supabase on every launch (credentials baked into BuildConfig),
     * then watch session status and start sync on authentication.
     *
     * We do NOT clear cachedAuthUser on NotAuthenticated — that would race with
     * the savedUser restoration and disable sync. Explicit sign-out is handled
     * in AccountViewModel which calls setCachedAuthUser(null) directly.
     */
    private fun scheduleHourlySync() {
        val request = PeriodicWorkRequestBuilder<SyncWorker>(1, TimeUnit.HOURS).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            SyncWorker.UNIQUE_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    private fun initSupabaseSync() {
        appScope.launch {
            // Restore saved username so isBogdan() can return true immediately.
            val savedUser = prefs.authUser.first()
            if (savedUser != null) supabase.setCachedAuthUser(savedUser)

            // Auto sign-in using BuildConfig credentials (set in local.properties).
            // This re-establishes the Supabase session on every launch without
            // requiring the user to enter credentials manually each time.
            val syncEmail = BuildConfig.SUPABASE_SYNC_EMAIL
            val syncPass  = BuildConfig.SUPABASE_SYNC_PASSWORD
            if (syncEmail.isNotBlank() && syncPass.isNotBlank()) {
                runCatching { supabase.signIn(syncEmail, syncPass) }
            }

            // Watch session status and start sync on authentication.
            supabase.sessionStatus.collect { status ->
                when (status) {
                    is SessionStatus.Authenticated -> {
                        val email = status.session.user?.email
                        val username = email?.substringBefore("@")
                        supabase.setCachedAuthUser(username)
                        prefs.setAuthUser(username)
                        syncEngine.start()
                    }
                    // NotAuthenticated: don't touch cachedAuthUser here —
                    // explicit sign-out clears it via AccountViewModel.
                    else -> Unit
                }
            }
        }
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
