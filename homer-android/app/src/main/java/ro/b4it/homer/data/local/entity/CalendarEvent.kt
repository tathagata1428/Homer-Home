package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "calendar_events")
data class CalendarEvent(
    @PrimaryKey val id: String,
    val title: String,
    val start: Long,
    val end: Long,
    val location: String = "",
    val description: String = "",
    val icsSource: String = "",
    val allDay: Boolean = false,
)
