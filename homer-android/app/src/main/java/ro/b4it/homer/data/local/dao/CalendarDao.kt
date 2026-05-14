package ro.b4it.homer.data.local.dao

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import ro.b4it.homer.data.local.entity.CalendarEvent

@Dao
interface CalendarDao {
    @Query("SELECT * FROM calendar_events WHERE start >= :fromMs ORDER BY start ASC")
    fun getEventsSince(fromMs: Long): Flow<List<CalendarEvent>>

    @Query("SELECT * FROM calendar_events WHERE start BETWEEN :fromMs AND :toMs ORDER BY start ASC")
    fun getEventsInRange(fromMs: Long, toMs: Long): Flow<List<CalendarEvent>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(event: CalendarEvent)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(events: List<CalendarEvent>)

    @Query("DELETE FROM calendar_events WHERE icsSource = :source")
    suspend fun deleteBySource(source: String)

    @Query("SELECT * FROM calendar_events WHERE start > :now ORDER BY start ASC")
    suspend fun getFutureEvents(now: Long): List<CalendarEvent>

    @Delete
    suspend fun delete(event: CalendarEvent)
}
