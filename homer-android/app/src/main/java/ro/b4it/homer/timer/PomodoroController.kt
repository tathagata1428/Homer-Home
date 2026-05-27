package ro.b4it.homer.timer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.MediaPlayer
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import ro.b4it.homer.MainActivity
import ro.b4it.homer.R
import ro.b4it.homer.data.local.dao.PomodoroDao
import ro.b4it.homer.data.local.entity.PomodoroSession
import ro.b4it.homer.data.local.entity.PomodoroTask
import ro.b4it.homer.data.preferences.AppPreferences
import ro.b4it.homer.data.sync.SyncEngine
import ro.b4it.homer.service.PomodoroService
import ro.b4it.homer.ui.screens.focus.PomodoroPhase
import ro.b4it.homer.ui.screens.focus.PomodoroSettings
import ro.b4it.homer.ui.screens.focus.PomodoroState
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Singleton timer engine — survives navigation between tabs.
 *
 * FocusViewModel is a thin wrapper around this class. Because this is a @Singleton,
 * the timer keeps running even when the user switches to another screen.
 * The PomodoroService foreground service keeps the process alive when the app is minimised.
 */
@Singleton
class PomodoroController @Inject constructor(
    @ApplicationContext private val ctx: Context,
    private val dao: PomodoroDao,
    private val prefs: AppPreferences,
    private val sync: SyncEngine,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _state    = MutableStateFlow(PomodoroState())
    val state: StateFlow<PomodoroState> = _state.asStateFlow()

    private val _settings = MutableStateFlow(PomodoroSettings())
    val settings: StateFlow<PomodoroSettings> = _settings.asStateFlow()

    val openTasks = dao.getOpenTasks()
    val allTasks  = dao.getAllTasks()

    private var timerJob: Job? = null

    init {
        scope.launch {
            combine(
                prefs.pomoFocus, prefs.pomoShort, prefs.pomoLong,
                prefs.pomoAutoStart, prefs.pomoNotif,
            ) { arr -> PomodoroSettings(
                focusMin      = arr[0] as Int,
                shortMin      = arr[1] as Int,
                longMin       = arr[2] as Int,
                autoStart     = arr[3] as Boolean,
                notifications = arr[4] as Boolean,
                voice         = _settings.value.voice,
                sfx           = _settings.value.sfx,
            )}.collect { s ->
                _settings.value = s
                if (!_state.value.running) resetTimer(_state.value.phase)
            }
        }
        scope.launch { prefs.pomoSfx.collect   { v -> _settings.update { it.copy(sfx   = v) } } }
        scope.launch { prefs.pomoVoice.collect  { v -> _settings.update { it.copy(voice = v) } } }
        ensureAlertChannel()
    }

    // ---- Public controls ----

    fun startPause() { if (_state.value.running) pause() else start() }

    fun start() {
        _state.update { it.copy(running = true) }
        startService()
        timerJob?.cancel()
        timerJob = scope.launch {
            while (_state.value.secsLeft > 0 && _state.value.running) {
                delay(1_000)
                val cur        = _state.value
                val newSecs    = cur.secsLeft - 1
                val newElapsed = if (cur.phase == PomodoroPhase.FOCUS)
                    cur.elapsedFocusSecs + 1 else cur.elapsedFocusSecs
                _state.update { it.copy(secsLeft = newSecs, elapsedFocusSecs = newElapsed) }
                updateServiceNotif("${cur.phase.label} %02d:%02d".format(newSecs / 60, newSecs % 60))
            }
            if (_state.value.secsLeft == 0) onPhaseEnd()
        }
    }

    fun pause() {
        _state.update { it.copy(running = false) }
        timerJob?.cancel()
        stopService()
    }

    fun reset() {
        pause()
        resetTimer(_state.value.phase)
        _state.update { it.copy(elapsedFocusSecs = 0) }
    }

    fun skip() {
        pause()
        val cur = _state.value
        if (cur.phase == PomodoroPhase.FOCUS && cur.elapsedFocusSecs >= 60) logSession(cur)
        advancePhase()
        if (_settings.value.autoStart) start()
    }

    // ---- Phase end ----

    private fun onPhaseEnd() {
        val cur = _state.value
        if (cur.phase == PomodoroPhase.FOCUS && cur.elapsedFocusSecs >= 60) logSession(cur)
        if (cur.phase == PomodoroPhase.FOCUS) playSound(R.raw.woohoo) else playSound(R.raw.doh)
        sendPhaseAlert(cur.phase)
        advancePhase()
        stopService()
        if (_settings.value.autoStart) start()
    }

    private fun sendPhaseAlert(endedPhase: PomodoroPhase) {
        if (!_settings.value.notifications) return
        val (title, body) = when (endedPhase) {
            PomodoroPhase.FOCUS -> "Focus session done!" to "Time for a break. Great work!"
            PomodoroPhase.SHORT -> "Break over" to "Back to focus — let's go!"
            PomodoroPhase.LONG  -> "Long break done" to "Ready for the next session?"
        }
        val tap = PendingIntent.getActivity(
            ctx, NOTIF_ID,
            Intent(ctx, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_SINGLE_TOP },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notif = NotificationCompat.Builder(ctx, CHANNEL_ALERT)
            .setSmallIcon(R.drawable.ic_homer_splash)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(tap)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        try { NotificationManagerCompat.from(ctx).notify(NOTIF_ID, notif) } catch (_: Exception) {}
    }

    private fun playSound(rawRes: Int) {
        if (!_settings.value.sfx) return
        try {
            MediaPlayer.create(ctx, rawRes)?.apply {
                setOnCompletionListener { it.release() }
                start()
            }
        } catch (_: Exception) {}
    }

    // ---- Phase helpers ----

    private fun advancePhase() {
        val cur = _state.value
        val (nextPhase, nextCycle) = when (cur.phase) {
            PomodoroPhase.FOCUS -> {
                val c = cur.cycleCount + 1
                if (c >= 4) Pair(PomodoroPhase.LONG, 0) else Pair(PomodoroPhase.SHORT, c)
            }
            PomodoroPhase.SHORT, PomodoroPhase.LONG -> Pair(PomodoroPhase.FOCUS, cur.cycleCount)
        }
        resetTimer(nextPhase)
        _state.update { it.copy(phase = nextPhase, cycleCount = nextCycle, elapsedFocusSecs = 0) }
    }

    private fun resetTimer(phase: PomodoroPhase) {
        val s = _settings.value
        val secs = when (phase) {
            PomodoroPhase.FOCUS -> s.focusMin * 60
            PomodoroPhase.SHORT -> s.shortMin * 60
            PomodoroPhase.LONG  -> s.longMin  * 60
        }
        _state.update { it.copy(secsLeft = secs, totalSecs = secs, running = false) }
    }

    private fun logSession(cur: PomodoroState) {
        scope.launch {
            dao.insertSession(PomodoroSession(durationSecs = cur.elapsedFocusSecs))
            sync.pushPomodoroTasksDebounced()
            sync.pushSessionsDebounced()
        }
    }

    // ---- Tasks ----

    fun addTask(text: String) {
        if (text.isBlank()) return
        scope.launch {
            dao.upsertTask(PomodoroTask(id = UUID.randomUUID().toString(), text = text))
            sync.pushPomodoroTasksDebounced()
        }
    }

    fun toggleTask(task: PomodoroTask) {
        // Completing a task deletes it immediately (clean focus UX — no "Done" accumulation)
        scope.launch { dao.deleteTask(task); sync.pushPomodoroTasksNow() }
    }

    fun deleteTask(task: PomodoroTask) {
        scope.launch { dao.deleteTask(task); sync.pushPomodoroTasksNow() }
    }

    fun clearDone() {
        scope.launch { dao.clearDoneTasks(); sync.pushPomodoroTasksNow() }
    }

    fun clearAllTasks() {
        scope.launch { dao.clearAllTasks(); sync.pushPomodoroTasksNow() }
    }

    // ---- Settings ----

    fun setFocusMin(v: Int)          { scope.launch { prefs.set(AppPreferences.KEY_POMO_FOCUS,     v) } }
    fun setShortMin(v: Int)          { scope.launch { prefs.set(AppPreferences.KEY_POMO_SHORT,     v) } }
    fun setLongMin(v: Int)           { scope.launch { prefs.set(AppPreferences.KEY_POMO_LONG,      v) } }
    fun setAutoStart(v: Boolean)     { scope.launch { prefs.set(AppPreferences.KEY_POMO_AUTOSTART, v) } }
    fun setNotifications(v: Boolean) { scope.launch { prefs.set(AppPreferences.KEY_POMO_NOTIF,     v) } }
    fun setVoice(v: Boolean)         { scope.launch { prefs.set(AppPreferences.KEY_POMO_VOICE,     v) } }
    fun setSfx(v: Boolean)           { scope.launch { prefs.set(AppPreferences.KEY_POMO_SFX,       v) } }

    // ---- Foreground service ----

    private fun startService() {
        val s    = _state.value
        val text = "${s.phase.label} %02d:%02d".format(s.secsLeft / 60, s.secsLeft % 60)
        try {
            ctx.startForegroundService(Intent(ctx, PomodoroService::class.java).apply {
                putExtra(PomodoroService.EXTRA_TIMER_TEXT, text)
            })
        } catch (_: Exception) {}
    }

    private fun updateServiceNotif(text: String) {
        try {
            ctx.startService(Intent(ctx, PomodoroService::class.java).apply {
                putExtra(PomodoroService.EXTRA_TIMER_TEXT, text)
            })
        } catch (_: Exception) {}
    }

    private fun stopService() {
        ctx.stopService(Intent(ctx, PomodoroService::class.java))
    }

    // ---- Notification channel ----

    private fun ensureAlertChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = ctx.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(
                CHANNEL_ALERT, "Pomodoro Alerts", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Vibrate + alert when a Pomodoro phase ends"
                enableVibration(true)
            })
        }
    }

    companion object {
        const val CHANNEL_ALERT = "homer_pomo_alert"
        const val NOTIF_ID      = 1003
    }
}
