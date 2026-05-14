package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "links")
data class Link(
    @PrimaryKey val id: String,
    val name: String,
    val url: String,
    val category: String = "",
    val emoji: String = "",
    val useFavicon: Boolean = false,
    val order: Int = 0,
    val updatedAt: Long = System.currentTimeMillis(),
)
