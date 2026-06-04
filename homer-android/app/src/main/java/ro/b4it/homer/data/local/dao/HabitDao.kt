package ro.b4it.homer.data.local.dao

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import ro.b4it.homer.data.local.entity.Habit
import ro.b4it.homer.data.local.entity.HabitCompletion

@Dao
interface HabitDao {
    @Query("SELECT * FROM habits WHERE clientId = :clientId LIMIT 1")
    suspend fun getHabitById(clientId: String): Habit?

    @Query("SELECT * FROM habits WHERE linkedTaskId = :taskId AND archived = 0 LIMIT 1")
    suspend fun getHabitByTaskId(taskId: String): Habit?

    @Query("SELECT * FROM habits WHERE archived = 0 ORDER BY displayOrder ASC, createdAt ASC")
    fun getActiveHabits(): Flow<List<Habit>>

    @Query("SELECT * FROM habits WHERE archived = 1 ORDER BY updatedAt DESC")
    fun getArchivedHabits(): Flow<List<Habit>>

    @Query("SELECT * FROM habits ORDER BY displayOrder ASC, createdAt ASC")
    fun getAllHabits(): Flow<List<Habit>>

    @Query("DELETE FROM habits WHERE clientId = :clientId")
    suspend fun hardDeleteById(clientId: String)

    @Query("DELETE FROM habit_completions WHERE habitClientId = :habitId")
    suspend fun deleteCompletionsForHabit(habitId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(habit: Habit)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(habits: List<Habit>)

    @Delete
    suspend fun delete(habit: Habit)

    // Completions
    @Query("SELECT * FROM habit_completions WHERE date = :date")
    fun getCompletionsForDate(date: String): Flow<List<HabitCompletion>>

    @Query("SELECT * FROM habit_completions WHERE habitClientId = :habitId ORDER BY date DESC")
    fun getCompletionsForHabit(habitId: String): Flow<List<HabitCompletion>>

    @Query("SELECT * FROM habit_completions WHERE date >= :fromDate ORDER BY date ASC")
    fun getCompletionsSince(fromDate: String): Flow<List<HabitCompletion>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCompletion(completion: HabitCompletion)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCompletions(completions: List<HabitCompletion>)

    @Query("DELETE FROM habit_completions WHERE habitClientId = :habitId AND date = :date")
    suspend fun deleteCompletion(habitId: String, date: String)

    @Query("DELETE FROM habits")
    suspend fun clearAll()

    @Query("DELETE FROM habit_completions")
    suspend fun clearAllCompletions()
}
