package ro.b4it.homer.ui.screens.focus

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import ro.b4it.homer.data.local.entity.PomodoroTask
import ro.b4it.homer.timer.PomodoroController
import javax.inject.Inject

enum class PomodoroPhase(val label: String) { FOCUS("Focus"), SHORT("Short Break"), LONG("Long Break") }

data class PomodoroState(
    val phase: PomodoroPhase      = PomodoroPhase.FOCUS,
    val running: Boolean          = false,
    val secsLeft: Int             = 25 * 60,
    val totalSecs: Int            = 25 * 60,
    val cycleCount: Int           = 0,
    val elapsedFocusSecs: Int     = 0,
)

data class PomodoroSettings(
    val focusMin: Int             = 25,
    val shortMin: Int             = 5,
    val longMin: Int              = 15,
    val autoStart: Boolean        = false,
    val notifications: Boolean    = true,
    val voice: Boolean            = false,
    val sfx: Boolean              = true,
)

/**
 * Thin wrapper around PomodoroController.
 * All timer logic lives in the singleton controller so it survives tab navigation.
 */
@HiltViewModel
class FocusViewModel @Inject constructor(
    private val controller: PomodoroController,
) : ViewModel() {

    val state: StateFlow<PomodoroState>       = controller.state
    val settings: StateFlow<PomodoroSettings> = controller.settings
    val openTasks                              = controller.openTasks
    val allTasks                               = controller.allTasks

    private val _newTask = MutableStateFlow("")
    val newTask: StateFlow<String> = _newTask.asStateFlow()

    fun startPause()   = controller.startPause()
    fun reset()        = controller.reset()
    fun skip()         = controller.skip()

    fun setNewTask(text: String) { _newTask.value = text }

    fun addTask() {
        val text = _newTask.value.trim()
        if (text.isBlank()) return
        controller.addTask(text)
        _newTask.value = ""
    }

    fun toggleTask(task: PomodoroTask) = controller.toggleTask(task)
    fun deleteTask(task: PomodoroTask) = controller.deleteTask(task)
    fun clearDone()                    = controller.clearDone()
    fun clearAllTasks()                = controller.clearAllTasks()

    fun setFocusMin(v: Int)          = controller.setFocusMin(v)
    fun setShortMin(v: Int)          = controller.setShortMin(v)
    fun setLongMin(v: Int)           = controller.setLongMin(v)
    fun setAutoStart(v: Boolean)     = controller.setAutoStart(v)
    fun setNotifications(v: Boolean) = controller.setNotifications(v)
    fun setVoice(v: Boolean)         = controller.setVoice(v)
    fun setSfx(v: Boolean)           = controller.setSfx(v)
}
