package ro.b4it.homer.data.local.dao

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import ro.b4it.homer.data.local.entity.Reminder

@Dao
interface ReminderDao {
    @Query("SELECT * FROM reminders ORDER BY triggerAt ASC")
    fun getAll(): Flow<List<Reminder>>

    @Query("SELECT * FROM reminders ORDER BY triggerAt ASC")
    suspend fun getAllSync(): List<Reminder>

    @Query("SELECT * FROM reminders WHERE enabled = 1 ORDER BY triggerAt ASC")
    suspend fun getEnabled(): List<Reminder>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(reminder: Reminder)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(reminders: List<Reminder>)

    @Delete
    suspend fun delete(reminder: Reminder)

    @Query("DELETE FROM reminders")
    suspend fun clearAll()

    @Query("UPDATE reminders SET triggerAt = :nextFireAt WHERE id = :id")
    suspend fun updateTriggerAt(id: String, nextFireAt: Long)

    @Query("UPDATE reminders SET enabled = :enabled WHERE id = :id")
    suspend fun setEnabled(id: String, enabled: Boolean)
}
