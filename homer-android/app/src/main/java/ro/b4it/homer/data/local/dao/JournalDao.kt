package ro.b4it.homer.data.local.dao

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import ro.b4it.homer.data.local.entity.JournalEntry

@Dao
interface JournalDao {
    @Query("SELECT * FROM journal_entries ORDER BY date DESC")
    fun getAll(): Flow<List<JournalEntry>>

    @Query("SELECT * FROM journal_entries WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): JournalEntry?

    @Query("SELECT * FROM journal_entries WHERE date = :date LIMIT 1")
    suspend fun getByDate(date: String): JournalEntry?

    @Query("SELECT * FROM journal_entries WHERE date >= :since ORDER BY date DESC")
    suspend fun getSince(since: String): List<JournalEntry>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: JournalEntry)

    @Delete
    suspend fun delete(entry: JournalEntry)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entries: List<JournalEntry>)

    @Query("DELETE FROM journal_entries")
    suspend fun clearAll()
}
