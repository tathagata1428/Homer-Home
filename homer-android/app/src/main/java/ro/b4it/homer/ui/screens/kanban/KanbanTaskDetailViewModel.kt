package ro.b4it.homer.ui.screens.kanban

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.KanbanDao
import ro.b4it.homer.data.local.entity.KanbanTask
import ro.b4it.homer.notification.ReminderManager
import javax.inject.Inject

@HiltViewModel
class KanbanTaskDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val dao: KanbanDao,
    private val reminderManager: ReminderManager,
) : ViewModel() {

    private val taskId: String = checkNotNull(savedStateHandle["taskId"])

    private val _task = MutableStateFlow<KanbanTask?>(null)
    val task: StateFlow<KanbanTask?> = _task.asStateFlow()

    private val _saved = MutableStateFlow(false)
    val saved: StateFlow<Boolean> = _saved.asStateFlow()

    init {
        viewModelScope.launch {
            _task.value = dao.getTaskById(taskId)
        }
    }

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
            summary = summary.trim(),
            description = desc.trim(),
            priority = priority,
            dueDate = dueDate.trim(),
            assignee = assignee.trim(),
            column = column,
            updatedAt = System.currentTimeMillis(),
        )
        viewModelScope.launch {
            dao.upsertTask(updated)
            _task.value = updated
            if (dueDate.isNotBlank()) reminderManager.scheduleTaskDue(updated)
            else reminderManager.cancelTask(updated.id)
            _saved.value = true
        }
    }
}
