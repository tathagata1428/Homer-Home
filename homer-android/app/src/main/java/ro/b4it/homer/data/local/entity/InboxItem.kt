package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "inbox_items")
data class InboxItem(
    @PrimaryKey val id: String,
    val text: String,
    val type: String = "thought",
    val createdAt: Long = System.currentTimeMillis(),
)
