package ro.b4it.homer.data.local.dao

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import ro.b4it.homer.data.local.entity.SavedQuote

@Dao
interface QuoteDao {
    @Query("SELECT * FROM saved_quotes ORDER BY savedAt DESC")
    fun getAll(): Flow<List<SavedQuote>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(quote: SavedQuote)

    @Delete
    suspend fun delete(quote: SavedQuote)

    @Query("DELETE FROM saved_quotes")
    suspend fun deleteAll()
}
