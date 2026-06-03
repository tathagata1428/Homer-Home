package ro.b4it.homer.data.local.dao

import androidx.room.*
import ro.b4it.homer.data.local.entity.SyncQueue

@Dao
interface SyncQueueDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueue(item: SyncQueue)

    @Query("SELECT * FROM sync_queue ORDER BY enqueuedAt ASC")
    suspend fun getAll(): List<SyncQueue>

    @Query("DELETE FROM sync_queue WHERE fieldId = :fieldId")
    suspend fun remove(fieldId: String)

    @Query("DELETE FROM sync_queue")
    suspend fun clear()
}
