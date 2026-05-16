package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "kanban_tasks")
data class KanbanTask(
    @PrimaryKey val id: String,
    val projectId: String,
    val summary: String,
    val description: String = "",
    val column: String = "todo",     // "todo" | "progress" | "pending" | "done"
    val priority: String = "medium", // "low" | "medium" | "high" | "critical"
    /** JSON array of label strings */
    val labelsJson: String = "[]",
    val reporter: String = "",
    val assignee: String = "",
    val dueDate: String = "",
    /** JSON array of subtask objects */
    val subtasksJson: String = "[]",
    /** JSON array of attachment refs */
    val attachmentsJson: String = "[]",
    val order: Int = 0,
    val archived: Boolean = false,
    val backlog: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis(),
)
