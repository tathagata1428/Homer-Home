package ro.b4it.homer.data.local.dao

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import ro.b4it.homer.data.local.entity.KanbanProject
import ro.b4it.homer.data.local.entity.KanbanTask

@Dao
interface KanbanDao {
    // Projects
    @Query("SELECT * FROM kanban_projects WHERE archived = 0 ORDER BY name ASC")
    fun getActiveProjects(): Flow<List<KanbanProject>>

    @Query("SELECT * FROM kanban_projects ORDER BY name ASC")
    fun getAllProjects(): Flow<List<KanbanProject>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertProject(project: KanbanProject)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertProjects(projects: List<KanbanProject>)

    @Delete
    suspend fun deleteProject(project: KanbanProject)

    // Tasks
    @Query("SELECT * FROM kanban_tasks WHERE projectId = :projectId AND archived = 0 ORDER BY `order` ASC")
    fun getTasksForProject(projectId: String): Flow<List<KanbanTask>>

    @Query("SELECT * FROM kanban_tasks WHERE id = :taskId LIMIT 1")
    suspend fun getTaskById(taskId: String): KanbanTask?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTask(task: KanbanTask)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTasks(tasks: List<KanbanTask>)

    @Delete
    suspend fun deleteTask(task: KanbanTask)

    @Query("UPDATE kanban_tasks SET `column` = :column, updatedAt = :ts WHERE id = :id")
    suspend fun moveTask(id: String, column: String, ts: Long = System.currentTimeMillis())

    @Query("SELECT * FROM kanban_tasks WHERE archived = 0 ORDER BY updatedAt DESC")
    fun getAllTasks(): Flow<List<KanbanTask>>

    @Query("SELECT * FROM kanban_tasks WHERE archived = 0 AND dueDate != '' ORDER BY dueDate ASC")
    suspend fun getTasksWithDueDates(): List<KanbanTask>

    @Query("SELECT * FROM kanban_tasks WHERE `column` = 'progress' AND archived = 0 ORDER BY updatedAt DESC LIMIT 10")
    suspend fun getInProgressTasks(): List<KanbanTask>

    @Query("SELECT * FROM kanban_tasks WHERE `column` = 'progress' AND archived = 0 ORDER BY updatedAt DESC LIMIT 10")
    fun getInProgressTasksFlow(): Flow<List<KanbanTask>>

    @Query("DELETE FROM kanban_projects")
    suspend fun clearAllProjects()

    @Query("DELETE FROM kanban_tasks")
    suspend fun clearAllTasks()
}
