package ro.b4it.homer.data.local.dao

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import ro.b4it.homer.data.local.entity.Link

@Dao
interface LinkDao {
    @Query("SELECT * FROM links ORDER BY `order` ASC, name ASC")
    fun getAll(): Flow<List<Link>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(link: Link)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(links: List<Link>)

    @Delete
    suspend fun delete(link: Link)

    @Query("DELETE FROM links WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM links")
    suspend fun deleteAll()
}
