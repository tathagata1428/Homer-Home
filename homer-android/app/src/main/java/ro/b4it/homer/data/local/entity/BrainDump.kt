package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "brain_dump")
data class BrainDump(
    @PrimaryKey val id: Int = 1,   // single-row
    val text: String = "",
    val updatedAt: Long = System.currentTimeMillis(),
)
