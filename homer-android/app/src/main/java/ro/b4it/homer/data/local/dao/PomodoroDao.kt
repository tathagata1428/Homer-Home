package ro.b4it.homer.data.local.dao

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import ro.b4it.homer.data.local.entity.PomodoroSession
import ro.b4it.homer.data.local.entity.PomodoroTask

@Dao
interface PomodoroDao {
    // Tasks
    @Query("SELECT * FROM pomodoro_tasks WHERE done = 0 ORDER BY createdAt ASC")
    fun getOpenTasks(): Flow<List<PomodoroTask>>

    @Query("SELECT * FROM pomodoro_tasks ORDER BY createdAt DESC")
    fun getAllTasks(): Flow<List<PomodoroTask>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTask(task: PomodoroTask)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAllTasks(tasks: List<PomodoroTask>)

    @Query("UPDATE pomodoro_tasks SET done = :done, updatedAt = :ts WHERE id = :id")
    suspend fun setTaskDone(id: String, done: Boolean, ts: Long = System.currentTimeMillis())

    @Delete
    suspend fun deleteTask(task: PomodoroTask)

    @Query("DELETE FROM pomodoro_tasks WHERE done = 1")
    suspend fun clearDoneTasks()

    // Sessions
    @Query("SELECT * FROM pomodoro_sessions ORDER BY ts DESC LIMIT 100")
    fun getRecentSessions(): Flow<List<PomodoroSession>>

    @Insert
    suspend fun insertSession(session: PomodoroSession)
}
