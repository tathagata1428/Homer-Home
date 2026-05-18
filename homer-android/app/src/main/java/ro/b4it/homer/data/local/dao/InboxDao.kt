package ro.b4it.homer.data.local.dao

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import ro.b4it.homer.data.local.entity.InboxItem

@Dao
interface InboxDao {
    @Query("SELECT * FROM inbox_items ORDER BY createdAt DESC")
    fun getAll(): Flow<List<InboxItem>>

    @Query("SELECT COUNT(*) FROM inbox_items")
    fun getCount(): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: InboxItem)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<InboxItem>)

    @Delete
    suspend fun delete(item: InboxItem)

    @Query("DELETE FROM inbox_items WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM inbox_items")
    suspend fun clearAll()
}
