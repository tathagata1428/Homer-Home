package ro.b4it.homer.data.local.dao

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import ro.b4it.homer.data.local.entity.Note

@Dao
interface NoteDao {
    @Query("SELECT * FROM notes ORDER BY updatedAt DESC")
    fun getAll(): Flow<List<Note>>

    @Query("SELECT * FROM notes WHERE parentId IS NULL ORDER BY pinned DESC, updatedAt DESC")
    fun getRootPages(): Flow<List<Note>>

    @Query("SELECT * FROM notes WHERE parentId = :parentId ORDER BY updatedAt DESC")
    fun getChildren(parentId: String): Flow<List<Note>>

    @Query("SELECT * FROM notes WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): Note?

    @Query("SELECT * FROM notes WHERE title LIKE '%' || :query || '%' OR content LIKE '%' || :query || '%'")
    fun search(query: String): Flow<List<Note>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(note: Note)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(notes: List<Note>)

    @Delete
    suspend fun delete(note: Note)

    @Query("DELETE FROM notes WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM notes")
    suspend fun clearAll()
}
