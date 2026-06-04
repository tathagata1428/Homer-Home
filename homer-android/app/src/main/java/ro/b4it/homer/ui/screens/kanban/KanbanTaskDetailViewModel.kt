package ro.b4it.homer.ui.screens.kanban

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import ro.b4it.homer.data.local.dao.HabitDao
import ro.b4it.homer.data.local.dao.KanbanDao
import ro.b4it.homer.data.local.entity.Habit
import ro.b4it.homer.data.local.entity.KanbanTask
import ro.b4it.homer.data.sync.SyncEngine
import ro.b4it.homer.notification.ReminderManager
import java.util.UUID
import javax.inject.Inject

@Serializable
data class SubTaskDto(val id: String, val text: String, val done: Boolean = false)

@HiltViewModel
class KanbanTaskDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val dao: KanbanDao,
    private val habitDao: HabitDao,
    private val reminderManager: ReminderManager,
    private val sync: SyncEngine,
) : ViewModel() {

    private val taskId: String = checkNotNull(savedStateHandle["taskId"])

    private val _task = MutableStateFlow<KanbanTask?>(null)
    val task: StateFlow<KanbanTask?> = _task.asStateFlow()

    private val _saved = MutableStateFlow(false)
    val saved: StateFlow<Boolean> = _saved.asStateFlow()

    private val _linkedHabit = MutableStateFlow<Habit?>(null)
    val linkedHabit: StateFlow<Habit?> = _linkedHabit.asStateFlow()

    private val json = Json { ignoreUnknownKeys = true }

    init {
        viewModelScope.launch {
            val t = dao.getTaskById(taskId)
            _task.value = t
            if (t != null && t.linkedHabitId.isNotBlank()) {
                _linkedHabit.value = habitDao.getHabitById(t.linkedHabitId)
            }
        }
    }

    fun parseSubtasks(jsonStr: String): List<SubTaskDto> =
        try { json.decodeFromString(jsonStr) } catch (_: Exception) { emptyList() }

    private fun encode(list: List<SubTaskDto>): String = json.encodeToString(list)

    // ── Main task save ────────────────────────────────────────────────────────

    fun save(
        summary: String,
        desc: String,
        priority: String,
        dueDate: String,
        assignee: String,
        column: String,
    ) {
        val current = _task.value ?: return
        val updated = current.copy(
            summary     = summary.trim(),
            description = desc.trim(),
            priority    = priority,
            dueDate     = dueDate.trim(),
            assignee    = assignee.trim(),
            column      = column,
            updatedAt   = System.currentTimeMillis(),
        )
        viewModelScope.launch {
            dao.upsertTask(updated)
            _task.value = updated
            if (dueDate.isNotBlank()) reminderManager.scheduleTaskDue(updated)
            else reminderManager.cancelTask(updated.id)
            _saved.value = true
            sync.pushKanbanDebounced()
        }
    }

    // ── Habit link ────────────────────────────────────────────────────────────

    fun createLinkedHabit(emoji: String, color: String, freq: String) {
        val current = _task.value ?: return
        viewModelScope.launch {
            val habit = Habit(
                clientId     = UUID.randomUUID().toString(),
                name         = current.summary.trim(),
                emoji        = emoji,
                color        = color,
                freq         = freq,
                linkedTaskId = current.id,
            )
            habitDao.upsert(habit)
            val updated = current.copy(
                linkedHabitId = habit.clientId,
                updatedAt     = System.currentTimeMillis(),
            )
            dao.upsertTask(updated)
            _task.value = updated
            _linkedHabit.value = habit
            sync.pushHabitsDebounced()
            sync.pushKanbanDebounced()
        }
    }

    fun unlinkHabit() {
        val current = _task.value ?: return
        val habit   = _linkedHabit.value ?: return
        viewModelScope.launch {
            habitDao.upsert(habit.copy(linkedTaskId = "", updatedAt = System.currentTimeMillis()))
            val updated = current.copy(linkedHabitId = "", updatedAt = System.currentTimeMillis())
            dao.upsertTask(updated)
            _task.value = updated
            _linkedHabit.value = null
            sync.pushHabitsDebounced()
            sync.pushKanbanDebounced()
        }
    }

    // ── Subtask CRUD ──────────────────────────────────────────────────────────

    fun addSubtask(text: String) {
        if (text.isBlank()) return
        val current   = _task.value ?: return
        val subtasks  = parseSubtasks(current.subtasksJson).toMutableList()
        subtasks.add(SubTaskDto(id = UUID.randomUUID().toString(), text = text.trim()))
        persist(current.copy(subtasksJson = encode(subtasks)))
    }

    fun toggleSubtask(subtaskId: String) {
        val current  = _task.value ?: return
        val subtasks = parseSubtasks(current.subtasksJson).map {
            if (it.id == subtaskId) it.copy(done = !it.done) else it
        }
        persist(current.copy(subtasksJson = encode(subtasks)))
    }

    fun deleteSubtask(subtaskId: String) {
        val current  = _task.value ?: return
        val subtasks = parseSubtasks(current.subtasksJson).filter { it.id != subtaskId }
        val task = current.copy(subtasksJson = encode(subtasks), updatedAt = System.currentTimeMillis())
        viewModelScope.launch {
            dao.upsertTask(task)
            _task.value = task
            sync.pushKanbanNow()
        }
    }

    private fun persist(updated: KanbanTask) {
        val task = updated.copy(updatedAt = System.currentTimeMillis())
        viewModelScope.launch {
            dao.upsertTask(task)
            _task.value = task
            sync.pushKanbanDebounced()
        }
    }
}
