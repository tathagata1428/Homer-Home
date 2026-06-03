package ro.b4it.homer.ui.screens.habits

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.HabitDao
import ro.b4it.homer.data.local.entity.Habit
import ro.b4it.homer.data.local.entity.HabitCompletion
import ro.b4it.homer.data.sync.SyncEngine
import java.time.LocalDate
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class HabitsViewModel @Inject constructor(
    private val dao: HabitDao,
    private val sync: SyncEngine,
) : ViewModel() {
    val habits = dao.getActiveHabits()
    val todayCompletions = dao.getCompletionsForDate(LocalDate.now().toString())
    val recentCompletions = dao.getCompletionsSince(LocalDate.now().minusDays(90).toString())

    fun addHabit(name: String, emoji: String, color: String, category: String, freq: String) {
        viewModelScope.launch {
            dao.upsert(Habit(
                clientId = UUID.randomUUID().toString(),
                name = name, emoji = emoji, color = color, category = category, freq = freq,
            ))
            sync.pushHabitsDebounced()
        }
    }

    fun toggleCompletion(habit: Habit, date: String, currentlyDone: Boolean) {
        viewModelScope.launch {
            if (currentlyDone) dao.deleteCompletion(habit.clientId, date)
            else dao.upsertCompletion(HabitCompletion(habitClientId = habit.clientId, date = date))
            sync.pushHabitsDebounced()
        }
    }

    fun deleteHabit(habit: Habit) {
        viewModelScope.launch {
            dao.upsert(habit.copy(archived = true, updatedAt = System.currentTimeMillis()))
            sync.pushHabitsNow()
        }
    }
}
