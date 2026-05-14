package ro.b4it.homer.data.local.dao

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import ro.b4it.homer.data.local.entity.LifeGoal

@Dao
interface LifeGoalDao {
    @Query("SELECT * FROM life_goals ORDER BY updatedAt DESC")
    fun getAll(): Flow<List<LifeGoal>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(goal: LifeGoal)

    @Delete
    suspend fun delete(goal: LifeGoal)
}
