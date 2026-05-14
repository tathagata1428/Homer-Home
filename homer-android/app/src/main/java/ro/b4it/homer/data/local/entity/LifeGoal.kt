package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "life_goals")
data class LifeGoal(
    @PrimaryKey val id: String,
    val title: String,
    val description: String = "",
    val category: String = "",
    val icon: String = "",
    val targetDate: String = "",
    /** JSON array of milestone objects {id, text, done} */
    val milestonesJson: String = "[]",
    val status: String = "active",  // "active" | "completed" | "paused"
    val progress: Int = 0,          // 0-100
    val updatedAt: Long = System.currentTimeMillis(),
)
