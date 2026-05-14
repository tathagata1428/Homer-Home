package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "habits")
data class Habit(
    @PrimaryKey val clientId: String,
    val name: String,
    val emoji: String = "",
    val color: String = "#3B82F6",
    val category: String = "",
    val freq: String = "daily",
    val target: Int = 1,
    val note: String = "",
    val archived: Boolean = false,
    val displayOrder: Int = 0,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)
