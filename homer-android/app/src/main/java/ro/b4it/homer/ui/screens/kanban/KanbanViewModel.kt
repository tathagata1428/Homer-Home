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
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class KanbanViewModel @Inject constructor(private val dao: KanbanDao) : ViewModel() {

    val projects = dao.getActiveProjects()

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

    fun addTask(summary: String, desc: String = "", priority: String = "medium") {
        val pid = _selectedProjectId.value ?: return
        viewModelScope.launch {
            dao.upsertTask(KanbanTask(
                id = UUID.randomUUID().toString(), projectId = pid,
                summary = summary, description = desc, priority = priority,
            ))
        }
    }

    fun moveTask(task: KanbanTask, column: String) {
        viewModelScope.launch { dao.moveTask(task.id, column) }
    }

    fun deleteTask(task: KanbanTask) {
        viewModelScope.launch { dao.deleteTask(task) }
    }
}
