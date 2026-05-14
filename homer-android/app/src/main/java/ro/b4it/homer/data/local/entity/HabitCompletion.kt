package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import kotlinx.serialization.Serializable

@Serializable
@Entity(
    tableName = "habit_completions",
    primaryKeys = ["habitClientId", "date"],
)
data class HabitCompletion(
    val habitClientId: String,
    val date: String,   // "YYYY-MM-DD"
    val count: Int = 1,
    val note: String = "",
)
