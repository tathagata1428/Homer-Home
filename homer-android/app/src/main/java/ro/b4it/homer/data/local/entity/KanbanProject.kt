package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "kanban_projects")
data class KanbanProject(
    @PrimaryKey val id: String,
    val name: String,
    val key: String,
    val description: String = "",
    val icon: String = "",
    val color: String = "#3B82F6",
    /** JSON array of custom field definitions */
    val customFieldsJson: String = "[]",
    val archived: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis(),
)
