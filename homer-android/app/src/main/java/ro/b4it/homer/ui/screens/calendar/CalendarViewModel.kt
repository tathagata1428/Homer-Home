package ro.b4it.homer.ui.screens.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.CalendarDao
import ro.b4it.homer.data.local.entity.CalendarEvent
import ro.b4it.homer.data.sync.SyncEngine
import ro.b4it.homer.notification.ReminderManager
import java.util.Calendar
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val dao: CalendarDao,
    private val reminderManager: ReminderManager,
    private val sync: SyncEngine,
) : ViewModel() {

    private val _selectedMonth = MutableStateFlow(
        Calendar.getInstance().let { it[Calendar.YEAR] * 12 + it[Calendar.MONTH] }
    )
    val selectedMonth: StateFlow<Int> = _selectedMonth.asStateFlow()

    @OptIn(ExperimentalCoroutinesApi::class)
    val events: Flow<List<CalendarEvent>> = _selectedMonth.flatMapLatest { ym ->
        val year  = ym / 12
        val month = ym % 12
        val cal   = Calendar.getInstance().apply { set(year, month, 1, 0, 0, 0); set(Calendar.MILLISECOND, 0) }
        val from  = cal.timeInMillis
        cal.add(Calendar.MONTH, 1)
        val to = cal.timeInMillis - 1
        dao.getEventsInRange(from, to)
    }

    fun prevMonth() { _selectedMonth.value -= 1 }
    fun nextMonth() { _selectedMonth.value += 1 }

    fun addEvent(title: String, startMs: Long, endMs: Long, location: String, desc: String, allDay: Boolean) {
        val event = CalendarEvent(
            id = UUID.randomUUID().toString(), title = title,
            start = startMs, end = endMs, location = location,
            description = desc, allDay = allDay,
        )
        viewModelScope.launch {
            dao.upsert(event)
            reminderManager.scheduleCalendarEvent(event)
            sync.pushCalendarEventsDebounced()
        }
    }

    fun deleteEvent(event: CalendarEvent) {
        viewModelScope.launch {
            dao.delete(event)
            reminderManager.cancelCalendarEvent(event.id)
            sync.pushCalendarEventsDebounced()
        }
    }
}
