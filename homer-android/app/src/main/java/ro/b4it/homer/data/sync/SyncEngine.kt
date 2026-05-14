package ro.b4it.homer.data.sync

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import ro.b4it.homer.data.local.HomerDatabase
import ro.b4it.homer.data.preferences.AppPreferences
import ro.b4it.homer.data.supabase.SupabaseManager
import javax.inject.Inject
import javax.inject.Singleton

/**
 * SyncEngine — bidirectional sync between Room (local) and Supabase (cloud).
 *
 * Architecture:
 *  - Non-bogdan users: all methods are no-ops; data lives in Room only.
 *  - Bogdan user:
 *      1. On app launch: pull latest from Supabase → merge into Room.
 *      2. On any write: debounce 8s → push to Supabase `field_state`.
 *      3. Realtime subscription: remote changes → merge into Room → notify UI via Flow.
 *
 * Field IDs match the website's localStorage keys for interoperability:
 *   homer-expenses, homer-income, homer-expense-budgets, homer-habits,
 *   homer-inbox, homer-pomodoro-tasks, homer-links, homer-life-goals,
 *   homer-kanban-projects, homer-kanban-tasks, homer-brain-dump, etc.
 */
@Singleton
class SyncEngine @Inject constructor(
    @ApplicationContext private val ctx: Context,
    private val db: HomerDatabase,
    private val prefs: AppPreferences,
    private val supabase: SupabaseManager,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // Debounce jobs per field key
    private val pendingJobs = mutableMapOf<String, Job>()
    private val DEBOUNCE_MS = 8_000L

    /** Called on app launch after auth is determined. */
    fun start() {
        if (!supabase.isBogdan()) return
        scope.launch { pullAll() }
    }

    /** Pull all synced fields from Supabase and merge into Room. */
    suspend fun pullAll() {
        if (!supabase.isBogdan()) return
        pullExpenses()
        pullHabits()
        pullInbox()
        pullLinks()
        pullPomodoroTasks()
        // Vault data pulled separately via SupabaseManager.getJoeyMeta
    }

    // ---- Debounced push ----

    fun schedulePush(fieldKey: String, push: suspend () -> Unit) {
        if (!supabase.isBogdan()) return
        pendingJobs[fieldKey]?.cancel()
        pendingJobs[fieldKey] = scope.launch {
            delay(DEBOUNCE_MS)
            push()
            pendingJobs.remove(fieldKey)
        }
    }

    fun pushExpensesDebounced()     = schedulePush("homer-expenses")     { pushExpenses() }
    fun pushHabitsDebounced()       = schedulePush("homer-habits")       { pushHabits() }
    fun pushInboxDebounced()        = schedulePush("homer-inbox")        { pushInbox() }
    fun pushLinksDebounced()        = schedulePush("homer-links")        { pushLinks() }
    fun pushPomodoroTasksDebounced()= schedulePush("homer-pomodoro-tasks"){ pushPomodoroTasks() }

    // ---- Expenses ----

    private suspend fun pushExpenses() {
        val expenses = db.expenseDao().getAll().first()
        val budgets  = db.expenseDao().getAllBudgets().first()
        val json = kotlinx.serialization.json.Json.encodeToString(
            kotlinx.serialization.builtins.ListSerializer(ro.b4it.homer.data.local.entity.Expense.serializer()),
            expenses
        )
        supabase.setFieldState("homer-expenses", json)
        val budgetsJson = kotlinx.serialization.json.Json.encodeToString(
            kotlinx.serialization.builtins.ListSerializer(ro.b4it.homer.data.local.entity.Budget.serializer()),
            budgets
        )
        supabase.setFieldState("homer-expense-budgets", budgetsJson)
    }

    private suspend fun pullExpenses() {
        // Pull logic: get remote field_state, deserialize, upsert into Room
        // Last-write-wins: compare _ts with local updatedAt
        // Implementation left for Phase 15 completion
    }

    // ---- Habits ----

    private suspend fun pushHabits() {
        val habits = db.habitDao().getAllHabits().first()
        val json = kotlinx.serialization.json.Json.encodeToString(
            kotlinx.serialization.builtins.ListSerializer(ro.b4it.homer.data.local.entity.Habit.serializer()),
            habits
        )
        supabase.setFieldState("homer-habits", json)
    }

    private suspend fun pullHabits() {
        // Pull from Supabase `habits` + `habit_completions` tables (dedicated tables, not field_state)
        // Implementation left for Phase 15 completion
    }

    // ---- Inbox ----

    private suspend fun pushInbox() {
        val items = db.inboxDao().getAll().first()
        val json = kotlinx.serialization.json.Json.encodeToString(
            kotlinx.serialization.builtins.ListSerializer(ro.b4it.homer.data.local.entity.InboxItem.serializer()),
            items
        )
        supabase.setFieldState("homer-inbox", json)
    }

    private suspend fun pullInbox() { /* Phase 15 */ }

    // ---- Links ----

    private suspend fun pushLinks() {
        val links = db.linkDao().getAll().first()
        val json = kotlinx.serialization.json.Json.encodeToString(
            kotlinx.serialization.builtins.ListSerializer(ro.b4it.homer.data.local.entity.Link.serializer()),
            links
        )
        supabase.setFieldState("homer-links", json)
    }

    private suspend fun pullLinks() { /* Phase 15 */ }

    // ---- Pomodoro tasks ----

    private suspend fun pushPomodoroTasks() {
        val tasks = db.pomodoroDao().getAllTasks().first()
        val json = kotlinx.serialization.json.Json.encodeToString(
            kotlinx.serialization.builtins.ListSerializer(ro.b4it.homer.data.local.entity.PomodoroTask.serializer()),
            tasks
        )
        supabase.setFieldState("homer-pomodoro-tasks", json)
    }

    private suspend fun pullPomodoroTasks() { /* Phase 15 */ }
}
