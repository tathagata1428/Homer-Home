package ro.b4it.homer.ui.screens.dailybrief

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.ExpenseDao
import ro.b4it.homer.data.local.dao.HabitDao
import ro.b4it.homer.data.local.dao.InboxDao
import ro.b4it.homer.data.local.dao.PomodoroDao
import ro.b4it.homer.data.local.entity.Habit
import ro.b4it.homer.data.local.entity.PomodoroTask
import ro.b4it.homer.data.remote.Quote
import ro.b4it.homer.data.remote.QuotesApi
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

data class DailyBriefState(
    val quote: Quote = Quote("Make today count.", ""),
    val pendingTasks: List<PomodoroTask> = emptyList(),
    val habits: List<Habit> = emptyList(),
    val inboxCount: Int = 0,
    val totalExpensesToday: Double = 0.0,
    val loading: Boolean = true,
)

@HiltViewModel
class DailyBriefViewModel @Inject constructor(
    private val inboxDao: InboxDao,
    private val pomDao: PomodoroDao,
    private val habitDao: HabitDao,
    private val expenseDao: ExpenseDao,
    private val quotesApi: QuotesApi,
) : ViewModel() {

    private val _state = MutableStateFlow(DailyBriefState())
    val state: StateFlow<DailyBriefState> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true)

            val allQuotes = try { quotesApi.fetchAll() } catch (_: Exception) { quotesApi.motivationalFallback() }
            val quote = allQuotes.randomOrNull() ?: Quote("Make today count.", "")

            val tasks  = try { pomDao.getOpenTasks().first() } catch (_: Exception) { emptyList() }
            val habits = try { habitDao.getActiveHabits().first() } catch (_: Exception) { emptyList() }
            val inbox  = try { inboxDao.getAll().first() } catch (_: Exception) { emptyList() }

            val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val expenses = try { expenseDao.getAll().first() } catch (_: Exception) { emptyList() }
            val todayTotal = expenses.filter { it.date == today && it.type == "expense" }.sumOf { it.amount }

            _state.value = DailyBriefState(
                quote = quote,
                pendingTasks = tasks.filter { !it.done }.take(5),
                habits = habits.take(5),
                inboxCount = inbox.size,
                totalExpensesToday = todayTotal,
                loading = false,
            )
        }
    }
}
