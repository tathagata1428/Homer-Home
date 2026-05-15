package ro.b4it.homer.ui.screens.kanban

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.KanbanDao
import ro.b4it.homer.data.local.entity.KanbanProject
import ro.b4it.homer.data.local.entity.KanbanTask
import ro.b4it.homer.notification.ReminderManager
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class KanbanViewModel @Inject constructor(
    private val dao: KanbanDao,
    private val reminderManager: ReminderManager,
) : ViewModel() {

    val projects = dao.getActiveProjects()
    val allTasks = dao.getAllTasks()

    private val _selectedProjectId = MutableStateFlow<String?>(null)
    val selectedProjectId: StateFlow<String?> = _selectedProjectId.asStateFlow()

    @OptIn(ExperimentalCoroutinesApi::class)
    val tasks: Flow<List<KanbanTask>> = _selectedProjectId.flatMapLatest { pid ->
        if (pid != null) dao.getTasksForProject(pid) else flowOf(emptyList())
    }

    fun selectProject(id: String?) { _selectedProjectId.value = id }

    fun addProject(name: String, key: String, desc: String, icon: String, color: String) {
        viewModelScope.launch {
            dao.upsertProject(
                KanbanProject(
                    id = UUID.randomUUID().toString(), name = name,
                    key = key.uppercase().take(6).ifBlank { name.take(3).uppercase() },
                    description = desc, icon = icon, color = color.ifBlank { "#3B82F6" },
                )
            )
        }
    }

    fun deleteProject(project: KanbanProject) {
        viewModelScope.launch { dao.deleteProject(project) }
    }

    fun addTask(summary: String, desc: String = "", priority: String = "medium", dueDate: String = "") {
        val pid = _selectedProjectId.value ?: return
        val task = KanbanTask(
            id = UUID.randomUUID().toString(), projectId = pid,
            summary = summary, description = desc, priority = priority, dueDate = dueDate,
        )
        viewModelScope.launch {
            dao.upsertTask(task)
            if (dueDate.isNotBlank()) reminderManager.scheduleTaskDue(task)
        }
    }

    fun moveTask(task: KanbanTask, column: String) {
        viewModelScope.launch {
            dao.moveTask(task.id, column)
            // Cancel due-date alarm when task is done
            if (column == "done") reminderManager.cancelTask(task.id)
        }
    }

    fun deleteTask(task: KanbanTask) {
        viewModelScope.launch {
            dao.deleteTask(task)
            reminderManager.cancelTask(task.id)
        }
    }
}
