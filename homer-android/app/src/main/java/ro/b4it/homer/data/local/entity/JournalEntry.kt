package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "journal_entries")
data class JournalEntry(
    @PrimaryKey val id: String,
    val date: String,               // YYYY-MM-DD, one entry per day
    val content: String = "",
    val mood: String = "",          // emoji e.g. "😊"
    val moodLabel: String = "",     // "Happy", "Reflective", etc.
    val aiReflection: String = "",  // JSON blob of JournalReflection
    val wordCount: Int = 0,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)
