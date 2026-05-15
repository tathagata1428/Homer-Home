package ro.b4it.homer.data.sync

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import ro.b4it.homer.data.local.HomerDatabase
import ro.b4it.homer.data.local.entity.*
import ro.b4it.homer.data.preferences.AppPreferences
import ro.b4it.homer.data.supabase.SupabaseManager
import javax.inject.Inject
import javax.inject.Singleton

/**
 * SyncEngine — bidirectional sync between Room (local) and Supabase (cloud).
 *
 * Rules:
 *  - Non-bogdan: all methods are no-ops; data lives only in Room.
 *  - Bogdan: on app launch pull latest → merge into Room; on write debounce 8s → push.
 *
 * Field IDs match the website's localStorage keys for data interoperability.
 */
@Singleton
class SyncEngine @Inject constructor(
    @ApplicationContext private val ctx: Context,
    private val db: HomerDatabase,
    private val prefs: AppPreferences,
    private val supabase: SupabaseManager,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val pendingJobs = mutableMapOf<String, Job>()
    private val DEBOUNCE_MS = 8_000L

    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    /** Called on app launch after auth is determined. */
    fun start() {
        if (!supabase.isBogdan()) return
        scope.launch { pullAll() }
    }

    /** Pull all synced fields from Supabase and merge into Room. */
    suspend fun pullAll() {
        if (!supabase.isBogdan()) return
        runCatching { pullExpenses() }
        runCatching { pullHabits() }
        runCatching { pullInbox() }
        runCatching { pullLinks() }
        runCatching { pullPomodoroTasks() }
    }

    // ---- Debounced push ----

    fun schedulePush(fieldKey: String, push: suspend () -> Unit) {
        if (!supabase.isBogdan()) return
        pendingJobs[fieldKey]?.cancel()
        pendingJobs[fieldKey] = scope.launch {
            delay(DEBOUNCE_MS)
            runCatching { push() }
            pendingJobs.remove(fieldKey)
        }
    }

    fun pushExpensesDebounced()      = schedulePush("homer-expenses")      { pushExpenses() }
    fun pushHabitsDebounced()        = schedulePush("homer-habits")        { pushHabits() }
    fun pushInboxDebounced()         = schedulePush("homer-inbox")         { pushInbox() }
    fun pushLinksDebounced()         = schedulePush("homer-links")         { pushLinks() }
    fun pushPomodoroTasksDebounced() = schedulePush("homer-pomodoro-tasks"){ pushPomodoroTasks() }

    // ---- Expenses ----

    private suspend fun pushExpenses() {
        val expenses = db.expenseDao().getAll().first()
        val budgets  = db.expenseDao().getAllBudgets().first()
        supabase.setFieldState("homer-expenses",
            json.encodeToString(ListSerializer(Expense.serializer()), expenses))
        supabase.setFieldState("homer-expense-budgets",
            json.encodeToString(ListSerializer(Budget.serializer()), budgets))
    }

    private suspend fun pullExpenses() {
        supabase.getFieldState("homer-expenses")?.let { row ->
            val items = json.decodeFromString(ListSerializer(Expense.serializer()), row.value.data)
            db.expenseDao().upsertAll(items)
        }
        supabase.getFieldState("homer-expense-budgets")?.let { row ->
            val items = json.decodeFromString(ListSerializer(Budget.serializer()), row.value.data)
            db.expenseDao().upsertBudgets(items)
        }
    }

    // ---- Habits ----

    private suspend fun pushHabits() {
        val habits = db.habitDao().getAllHabits().first()
        supabase.setFieldState("homer-habits",
            json.encodeToString(ListSerializer(Habit.serializer()), habits))
    }

    private suspend fun pullHabits() {
        supabase.getFieldState("homer-habits")?.let { row ->
            val items = json.decodeFromString(ListSerializer(Habit.serializer()), row.value.data)
            db.habitDao().upsertAll(items)
        }
    }

    // ---- Inbox ----

    private suspend fun pushInbox() {
        val items = db.inboxDao().getAll().first()
        supabase.setFieldState("homer-inbox",
            json.encodeToString(ListSerializer(InboxItem.serializer()), items))
    }

    private suspend fun pullInbox() {
        supabase.getFieldState("homer-inbox")?.let { row ->
            val items = json.decodeFromString(ListSerializer(InboxItem.serializer()), row.value.data)
            db.inboxDao().upsertAll(items)
        }
    }

    // ---- Links ----

    private suspend fun pushLinks() {
        val links = db.linkDao().getAll().first()
        supabase.setFieldState("homer-links",
            json.encodeToString(ListSerializer(Link.serializer()), links))
    }

    private suspend fun pullLinks() {
        supabase.getFieldState("homer-links")?.let { row ->
            val items = json.decodeFromString(ListSerializer(Link.serializer()), row.value.data)
            db.linkDao().upsertAll(items)
        }
    }

    // ---- Pomodoro tasks ----

    private suspend fun pushPomodoroTasks() {
        val tasks = db.pomodoroDao().getAllTasks().first()
        supabase.setFieldState("homer-pomodoro-tasks",
            json.encodeToString(ListSerializer(PomodoroTask.serializer()), tasks))
    }

    private suspend fun pullPomodoroTasks() {
        supabase.getFieldState("homer-pomodoro-tasks")?.let { row ->
            val items = json.decodeFromString(ListSerializer(PomodoroTask.serializer()), row.value.data)
            db.pomodoroDao().upsertAllTasks(items)
        }
    }
}
