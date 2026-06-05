package ro.b4it.homer.ui.screens.dailybrief

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.CarDao
import ro.b4it.homer.data.local.dao.ExpenseDao
import ro.b4it.homer.data.local.dao.HabitDao
import ro.b4it.homer.data.local.dao.InboxDao
import ro.b4it.homer.data.local.dao.KanbanDao
import ro.b4it.homer.data.local.dao.LifeGoalDao
import ro.b4it.homer.data.local.entity.Habit
import ro.b4it.homer.data.local.entity.KanbanTask
import ro.b4it.homer.data.local.entity.LifeGoal
import ro.b4it.homer.data.remote.Quote
import ro.b4it.homer.data.remote.QuotesApi
import java.text.SimpleDateFormat
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.Date
import java.util.Locale
import javax.inject.Inject

data class CarAlert(
    val label: String,
    val expiryDate: String, // YYYY-MM-DD
    val daysLeft: Long,     // negative = expired
)

data class DailyBriefState(
    val quote: Quote = Quote("Make today count.", ""),
    val inProgressTasks: List<KanbanTask> = emptyList(),
    val habits: List<Habit> = emptyList(),
    val lifeGoals: List<LifeGoal> = emptyList(),
    val inboxCount: Int = 0,
    val totalExpensesToday: Double = 0.0,
    val carAlerts: List<CarAlert> = emptyList(),
    val loading: Boolean = true,
)

@HiltViewModel
class DailyBriefViewModel @Inject constructor(
    private val inboxDao: InboxDao,
    private val kanbanDao: KanbanDao,
    private val habitDao: HabitDao,
    private val lifeGoalDao: LifeGoalDao,
    private val expenseDao: ExpenseDao,
    private val carDao: CarDao,
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

            val inProgress = try { kanbanDao.getInProgressTasks() } catch (_: Exception) { emptyList() }
            val habits = try { habitDao.getActiveHabits().first() } catch (_: Exception) { emptyList() }
            val goals  = try { lifeGoalDao.getGoalsWithTargetDates() } catch (_: Exception) { emptyList() }
            val inbox  = try { inboxDao.getAll().first() } catch (_: Exception) { emptyList() }

            val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val expenses = try { expenseDao.getAll().first() } catch (_: Exception) { emptyList() }
            val todayTotal = expenses.filter { it.date == today && it.type == "expense" }.sumOf { it.amount }

            // Car alerts: documents and maintenance due within 7 days or already expired
            val todayDate = LocalDate.now()
            val carAlerts = mutableListOf<CarAlert>()
            try {
                carDao.getAllDocuments().first().filter { it.expiryDate.isNotBlank() }.forEach { doc ->
                    val expiry = runCatching { LocalDate.parse(doc.expiryDate) }.getOrNull() ?: return@forEach
                    val days = ChronoUnit.DAYS.between(todayDate, expiry)
                    if (days <= 7) carAlerts.add(CarAlert(doc.label.ifBlank { doc.type }, doc.expiryDate, days))
                }
                carDao.getAllMaintenance().first().filter { it.nextDateDue.isNotBlank() }.forEach { m ->
                    val due = runCatching { LocalDate.parse(m.nextDateDue) }.getOrNull() ?: return@forEach
                    val days = ChronoUnit.DAYS.between(todayDate, due)
                    if (days <= 7) carAlerts.add(CarAlert(m.label.ifBlank { m.type }, m.nextDateDue, days))
                }
            } catch (_: Exception) {}
            carAlerts.sortBy { it.daysLeft }

            _state.value = DailyBriefState(
                quote = quote,
                inProgressTasks = inProgress.take(8),
                habits = habits.take(5),
                lifeGoals = goals.take(4),
                inboxCount = inbox.size,
                totalExpensesToday = todayTotal,
                carAlerts = carAlerts,
                loading = false,
            )
        }
    }
}
