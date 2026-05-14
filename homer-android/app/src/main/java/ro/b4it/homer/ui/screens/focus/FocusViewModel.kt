package ro.b4it.homer.ui.screens.focus

import android.content.Context
import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.PomodoroDao
import ro.b4it.homer.data.local.entity.PomodoroSession
import ro.b4it.homer.data.local.entity.PomodoroTask
import ro.b4it.homer.data.preferences.AppPreferences
import ro.b4it.homer.data.sync.SyncEngine
import ro.b4it.homer.service.PomodoroService
import java.util.UUID
import javax.inject.Inject

enum class PomodoroPhase(val label: String) { FOCUS("Focus"), SHORT("Short Break"), LONG("Long Break") }

data class PomodoroState(
    val phase: PomodoroPhase = PomodoroPhase.FOCUS,
    val running: Boolean = false,
    val secsLeft: Int = 25 * 60,
    val totalSecs: Int = 25 * 60,
    val cycleCount: Int = 0,    // 0-3; resets after long break
    val elapsedFocusSecs: Int = 0,
)

data class PomodoroSettings(
    val focusMin: Int = 25,
    val shortMin: Int = 5,
    val longMin: Int = 15,
    val autoStart: Boolean = false,
    val notifications: Boolean = true,
    val voice: Boolean = false,
    val sfx: Boolean = true,
)

@HiltViewModel
class FocusViewModel @Inject constructor(
    @ApplicationContext private val ctx: Context,
    private val dao: PomodoroDao,
    private val prefs: AppPreferences,
    private val sync: SyncEngine,
) : ViewModel() {

    private val _state = MutableStateFlow(PomodoroState())
    val state: StateFlow<PomodoroState> = _state.asStateFlow()

    private val _settings = MutableStateFlow(PomodoroSettings())
    val settings: StateFlow<PomodoroSettings> = _settings.asStateFlow()

    val openTasks  = dao.getOpenTasks()
    val allTasks   = dao.getAllTasks()
    val sessions   = dao.getRecentSessions()

    private var timerJob: Job? = null
    private var newTaskText = MutableStateFlow("")
    val newTask: StateFlow<String> = newTaskText.asStateFlow()

    init {
        viewModelScope.launch {
            combine(
                prefs.pomoFocus, prefs.pomoShort, prefs.pomoLong,
                prefs.pomoAutoStart, prefs.pomoNotif,
            ) { arr -> PomodoroSettings(
                focusMin   = arr[0] as Int,
                shortMin   = arr[1] as Int,
                longMin    = arr[2] as Int,
                autoStart  = arr[3] as Boolean,
                notifications = arr[4] as Boolean,
            )}.collect { s ->
                _settings.value = s
                if (!_state.value.running) resetTimer(_state.value.phase)
            }
        }
    }

    fun startPause() {
        if (_state.value.running) pause() else start()
    }

    private fun start() {
        _state.update { it.copy(running = true) }
        startService()
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (_state.value.secsLeft > 0 && _state.value.running) {
                delay(1_000)
                val cur = _state.value
                val newSecs   = cur.secsLeft - 1
                val newElapsed = if (cur.phase == PomodoroPhase.FOCUS) cur.elapsedFocusSecs + 1 else cur.elapsedFocusSecs
                _state.update { it.copy(secsLeft = newSecs, elapsedFocusSecs = newElapsed) }
            }
            if (_state.value.secsLeft == 0) onPhaseEnd()
        }
    }

    private fun pause() {
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

    private fun onPhaseEnd() {
        val cur = _state.value
        if (cur.phase == PomodoroPhase.FOCUS && cur.elapsedFocusSecs >= 60) logSession(cur)
        advancePhase()
        stopService()
        if (_settings.value.autoStart) start()
    }

    private fun advancePhase() {
        val cur = _state.value
        val s   = _settings.value
        val (nextPhase, nextCycle) = when (cur.phase) {
            PomodoroPhase.FOCUS -> {
                val c = cur.cycleCount + 1
                if (c >= 4) Pair(PomodoroPhase.LONG, 0)
                else Pair(PomodoroPhase.SHORT, c)
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
        viewModelScope.launch {
            dao.insertSession(PomodoroSession(durationSecs = cur.elapsedFocusSecs))
            sync.pushPomodoroTasksDebounced()
        }
    }

    // ---- Tasks ----

    fun setNewTask(text: String) { newTaskText.value = text }

    fun addTask() {
        val text = newTask.value.trim()
        if (text.isBlank()) return
        viewModelScope.launch {
            dao.upsertTask(PomodoroTask(id = UUID.randomUUID().toString(), text = text))
            newTaskText.value = ""
            sync.pushPomodoroTasksDebounced()
        }
    }

    fun toggleTask(task: PomodoroTask) {
        viewModelScope.launch {
            dao.setTaskDone(task.id, !task.done)
            sync.pushPomodoroTasksDebounced()
        }
    }

    fun deleteTask(task: PomodoroTask) {
        viewModelScope.launch {
            dao.deleteTask(task)
            sync.pushPomodoroTasksDebounced()
        }
    }

    fun clearDone() {
        viewModelScope.launch {
            dao.clearDoneTasks()
            sync.pushPomodoroTasksDebounced()
        }
    }

    // ---- Settings ----

    fun setFocusMin(v: Int)  { viewModelScope.launch { prefs.set(AppPreferences.KEY_POMO_FOCUS, v) } }
    fun setShortMin(v: Int)  { viewModelScope.launch { prefs.set(AppPreferences.KEY_POMO_SHORT, v) } }
    fun setLongMin(v: Int)   { viewModelScope.launch { prefs.set(AppPreferences.KEY_POMO_LONG, v) } }
    fun setAutoStart(v: Boolean) { viewModelScope.launch { prefs.set(AppPreferences.KEY_POMO_AUTOSTART, v) } }
    fun setNotifications(v: Boolean) { viewModelScope.launch { prefs.set(AppPreferences.KEY_POMO_NOTIF, v) } }
    fun setVoice(v: Boolean) { viewModelScope.launch { prefs.set(AppPreferences.KEY_POMO_VOICE, v) } }
    fun setSfx(v: Boolean)   { viewModelScope.launch { prefs.set(AppPreferences.KEY_POMO_SFX, v) } }

    // ---- Service ----
    private fun startService() {
        ctx.startForegroundService(Intent(ctx, PomodoroService::class.java))
    }
    private fun stopService() {
        ctx.stopService(Intent(ctx, PomodoroService::class.java))
    }

    override fun onCleared() {
        super.onCleared()
        timerJob?.cancel()
    }
}
