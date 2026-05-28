package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

/**
 * Standalone recurring reminder.
 * recurType: "none" | "daily" | "weekly" | "monthly" | "yearly"
 */
@Serializable
@Entity(tableName = "reminders")
data class Reminder(
    @PrimaryKey val id: String,
    val title: String,
    val body: String = "",
    /** Epoch ms of next (or only) firing time */
    val triggerAt: Long,
    val recurType: String = "none",
    val enabled: Boolean = true,
    val createdAt: Long = System.currentTimeMillis(),
)
