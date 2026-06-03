package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Tracks fields that failed to push (offline / network error).
 * Drained on next sync cycle so no user edit is silently lost.
 */
@Entity(tableName = "sync_queue")
data class SyncQueue(
    @PrimaryKey val fieldId: String,
    val enqueuedAt: Long = System.currentTimeMillis(),
)
