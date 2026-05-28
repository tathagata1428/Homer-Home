package ro.b4it.homer.data.sync

import android.content.Context
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.*
import ro.b4it.homer.data.local.HomerDatabase
import ro.b4it.homer.data.local.entity.*
import ro.b4it.homer.data.preferences.AppPreferences
import ro.b4it.homer.data.supabase.SupabaseManager
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * SyncEngine — bidirectional sync between Room (local) and Supabase (cloud).
 *
 * Rules:
 *  - Non-bogdan: all methods are no-ops; data lives only in Room.
 *  - Bogdan: on app launch pull latest → merge into Room; on write debounce 8s → push.
 *
 * Field IDs and JSON formats MUST match the website's localStorage / field_state schema.
 * See comments on each section for the exact website data shape.
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

    private var startCount = 0

    /**
     * Pull on sign-in so Room is up to date, then push on first launch so any
     * data added before sync was wired up (pre-fix builds) reaches Supabase.
     */
    fun start() {
        val isFirstStart = startCount++ == 0
        scope.launch {
            runCatching { pullAll() }
                .onFailure { Log.e("HomerSync", "start: pullAll failed", it) }
            if (isFirstStart) {
                runCatching { pushAll() }
                    .onFailure { Log.e("HomerSync", "start: pushAll failed", it) }
            }
        }
    }

    /** Pull all synced fields from Supabase and merge into Room. Throws on auth failure. */
    suspend fun pullAll() {
        supabase.ensureSignedIn()
        Log.d("HomerSync", "pullAll: userId=${supabase.userId} isBogdan=${supabase.isBogdan()}")
        if (!supabase.isBogdan()) { Log.w("HomerSync", "pullAll: not Bogdan, aborting"); return }
        if (isFieldEnabled("ls:homer-expenses"))  runCatching { pullExpenses()      }.onFailure { Log.e("HomerSync", "pullExpenses failed", it) }
        if (isFieldEnabled("ls:homer-habits"))    runCatching { pullHabits()        }.onFailure { Log.e("HomerSync", "pullHabits failed", it) }
        if (isFieldEnabled("ls:homer-inbox"))     runCatching { pullInbox()         }.onFailure { Log.e("HomerSync", "pullInbox failed", it) }
        if (isFieldEnabled("ls:homer-links"))     runCatching { pullLinks()         }.onFailure { Log.e("HomerSync", "pullLinks failed", it) }
        if (isFieldEnabled("ls:pom-tasks"))       runCatching { pullPomodoroTasks() }.onFailure { Log.e("HomerSync", "pullTasks failed", it) }
        if (isFieldEnabled("ls:homer-notes"))     runCatching { pullNotes()         }.onFailure { Log.e("HomerSync", "pullNotes failed", it) }
        if (isFieldEnabled("ls:homer-journal"))   runCatching { pullJournal()       }.onFailure { Log.e("HomerSync", "pullJournal failed", it) }
        if (isFieldEnabled("ls:homer-car"))       runCatching { pullCar()           }.onFailure { Log.e("HomerSync", "pullCar failed", it) }
        if (isFieldEnabled("ls:homer-kanban"))         runCatching { pullKanban()        }.onFailure { Log.e("HomerSync", "pullKanban failed", it) }
        if (isFieldEnabled("ls:homer-life-goals"))     runCatching { pullLifeGoals()     }.onFailure { Log.e("HomerSync", "pullLifeGoals failed", it) }
        if (isFieldEnabled("ls:homer-brain-dump"))    runCatching { pullBrainDump()     }.onFailure { Log.e("HomerSync", "pullBrainDump failed", it) }
        if (isFieldEnabled("ls:homer-zen-goal"))      runCatching { pullZenGoal()       }.onFailure { Log.e("HomerSync", "pullZenGoal failed", it) }
        if (isFieldEnabled("ls:homer-expense-goals")) runCatching { pullExpenseGoals()  }.onFailure { Log.e("HomerSync", "pullExpenseGoals failed", it) }
        if (isFieldEnabled("ls:homer-cal-events"))    runCatching { pullCalendarEvents()}.onFailure { Log.e("HomerSync", "pullCalendarEvents failed", it) }
        if (isFieldEnabled("ls:savedQuotes"))              runCatching { pullSavedQuotes()     }.onFailure { Log.e("HomerSync", "pullSavedQuotes failed", it) }
        if (isFieldEnabled("ls:homer-sessions"))           runCatching { pullSessions()        }.onFailure { Log.e("HomerSync", "pullSessions failed", it) }
        if (isFieldEnabled("ls:pom-settings"))             runCatching { pullPomSettings()     }.onFailure { Log.e("HomerSync", "pullPomSettings failed", it) }
        if (isFieldEnabled("ls:homer-expense-templates"))  runCatching { pullExpenseTemplates()}.onFailure { Log.e("HomerSync", "pullExpenseTemplates failed", it) }
        if (isFieldEnabled("ls:homer-expense-cats"))       runCatching { pullExpenseCats()     }.onFailure { Log.e("HomerSync", "pullExpenseCats failed", it) }
        if (isFieldEnabled("ls:homer-payday-day"))         runCatching { pullPaydayDay()       }.onFailure { Log.e("HomerSync", "pullPaydayDay failed", it) }
        if (isFieldEnabled("ls:homer-recurring"))          runCatching { pullRecurring()       }.onFailure { Log.e("HomerSync", "pullRecurring failed", it) }
        if (isFieldEnabled("ls:homer-weekly-reviews"))     runCatching { pullWeeklyReviews()   }.onFailure { Log.e("HomerSync", "pullWeeklyReviews failed", it) }
        if (isFieldEnabled("ls:homer-countdown"))           runCatching { pullCountdown()        }.onFailure { Log.e("HomerSync", "pullCountdown failed", it) }
        if (isFieldEnabled("ls:homer-secrets"))             runCatching { pullSecrets()          }.onFailure { Log.e("HomerSync", "pullSecrets failed", it) }
        if (isFieldEnabled("ls:homer-vault-notes"))         runCatching { pullVaultNotes()       }.onFailure { Log.e("HomerSync", "pullVaultNotes failed", it) }
        if (isFieldEnabled("ls:homer-reminders"))           runCatching { pullReminders()        }.onFailure { Log.e("HomerSync", "pullReminders failed", it) }
        Log.d("HomerSync", "pullAll: done")
    }

    // ---- Debounced push ----

    /** Returns false if the user has disabled sync for this field. Default = enabled. */
    fun isFieldEnabled(fieldKey: String): Boolean =
        ctx.getSharedPreferences("homer_sync_scope", Context.MODE_PRIVATE)
            .getBoolean(fieldKey, true)

    fun schedulePush(fieldKey: String, push: suspend () -> Unit) {
        if (!isFieldEnabled(fieldKey)) return
        synchronized(pendingJobs) {
            pendingJobs[fieldKey]?.cancel()
            pendingJobs[fieldKey] = scope.launch {
                delay(DEBOUNCE_MS)
                runCatching {
                    supabase.ensureSignedIn()
                    if (!supabase.isBogdan()) return@runCatching
                    push()
                }.onFailure { Log.e("HomerSync", "schedulePush[$fieldKey] failed", it) }
            }
        }
    }

    /**
     * Cancel any pending debounced push for [fieldKey].
     * Called from applyFieldUpdate so a Realtime update from another device
     * doesn't get overwritten by a stale local push queued before the update arrived.
     */
    fun cancelPendingPush(fieldKey: String) {
        synchronized(pendingJobs) {
            pendingJobs[fieldKey]?.cancel()
            pendingJobs.remove(fieldKey)
        }
    }

    fun pushExpensesDebounced()      = schedulePush("ls:homer-expenses")   { pushExpenses() }
    fun pushHabitsDebounced()        = schedulePush("ls:homer-habits")     { pushHabits() }
    fun pushInboxDebounced()         = schedulePush("ls:homer-inbox")      { pushInbox() }
    fun pushLinksDebounced()         = schedulePush("ls:homer-links")      { pushLinks() }
    fun pushPomodoroTasksDebounced() = schedulePush("ls:pom-tasks")        { pushPomodoroTasks() }
    fun pushNotesDebounced()         = schedulePush("ls:homer-notes")      { pushNotes() }
    fun pushJournalDebounced()       = schedulePush("ls:homer-journal")    { pushJournal() }
    fun pushCarDebounced()           = schedulePush("ls:homer-car")        { pushCar() }
    fun pushKanbanDebounced()            = schedulePush("ls:homer-kanban")              { pushKanban() }
    fun pushLifeGoalsDebounced()         = schedulePush("ls:homer-life-goals")          { pushLifeGoals() }
    fun pushBrainDumpDebounced()         = schedulePush("ls:homer-brain-dump")          { pushBrainDump() }
    fun pushZenGoalDebounced()           = schedulePush("ls:homer-zen-goal")            { pushZenGoal() }
    fun pushExpenseGoalsDebounced()      = schedulePush("ls:homer-expense-goals")       { pushExpenseGoals() }
    fun pushCalendarEventsDebounced()    = schedulePush("ls:homer-cal-events")          { pushCalendarEvents() }
    fun pushSavedQuotesDebounced()       = schedulePush("ls:savedQuotes")               { pushSavedQuotes() }
    fun pushSessionsDebounced()          = schedulePush("ls:homer-sessions")            { pushSessions() }
    fun pushPomSettingsDebounced()       = schedulePush("ls:pom-settings")              { pushPomSettings() }
    fun pushExpenseTemplatesDebounced()  = schedulePush("ls:homer-expense-templates")   { pushExpenseTemplates() }
    fun pushExpenseCatsDebounced()       = schedulePush("ls:homer-expense-cats")        { pushExpenseCats() }
    fun pushPaydayDayDebounced()         = schedulePush("ls:homer-payday-day")          { pushPaydayDay() }
    fun pushRecurringDebounced()         = schedulePush("ls:homer-recurring")           { pushRecurring() }
    fun pushWeeklyReviewsDebounced()     = schedulePush("ls:homer-weekly-reviews")      { pushWeeklyReviews() }
    fun pushCountdownDebounced()         = schedulePush("ls:homer-countdown")            { pushCountdown() }
    fun pushSecretsDebounced()           = schedulePush("ls:homer-secrets")              { pushSecrets() }
    fun pushVaultNotesDebounced()        = schedulePush("ls:homer-vault-notes")          { pushVaultNotes() }
    fun pushRemindersDebounced()         = schedulePush("ls:homer-reminders")            { pushReminders() }

    /** Push all data to Supabase immediately (no debounce). Throws on auth failure. */
    suspend fun pushAll() {
        supabase.ensureSignedIn()
        if (!supabase.isBogdan()) return
        runCatching { pushExpenses() }
        runCatching { pushHabits() }
        runCatching { pushInbox() }
        runCatching { pushLinks() }
        runCatching { pushPomodoroTasks() }
        runCatching { pushNotes() }
        runCatching { pushJournal() }
        runCatching { pushCar() }
        runCatching { pushKanban() }
        runCatching { pushLifeGoals() }
        runCatching { pushBrainDump() }
        runCatching { pushZenGoal() }
        runCatching { pushExpenseGoals() }
        runCatching { pushCalendarEvents() }
        runCatching { pushSavedQuotes() }
        runCatching { pushSessions() }
        runCatching { pushPomSettings() }
        runCatching { pushExpenseTemplates() }
        runCatching { pushExpenseCats() }
        runCatching { pushPaydayDay() }
        runCatching { pushRecurring() }
        runCatching { pushWeeklyReviews() }
        runCatching { pushCountdown() }
        runCatching { pushSecrets() }
        runCatching { pushVaultNotes() }
        runCatching { pushReminders() }
    }

    /** Push Pomodoro tasks immediately — called on delete so Supabase is updated before any pull. */
    suspend fun pushPomodoroTasksNow() {
        if (!supabase.isBogdan()) return
        runCatching { pushPomodoroTasks() }
    }

    /** Push vault secrets immediately — called on add/delete to prevent next pull from restoring deleted items. */
    suspend fun pushSecretsNow() {
        if (!supabase.isBogdan()) return
        runCatching { pushSecrets() }
    }

    // ── Expenses ─────────────────────────────────────────────────────────────
    // Website expense key: "homer-expenses" → [{id, desc, amount, cat, date, note}]
    // Website income key:  "homer-income"   → [{id, desc, amount, date, note}]
    // Website budgets key: "homer-expense-budgets" → {category: limit} (plain object)
    // Android: Expense entity with type="expense"|"income"; Budget entity {category, limit}
    // Bridge: website uses "desc"/"cat", Android uses "description"/"category".

    @Serializable
    private data class WsExpense(
        val id: JsonElement = JsonPrimitive(""),
        val desc: String = "",           // website field name
        val description: String = "",    // android push format (fallback on pull)
        val amount: Double = 0.0,
        val cat: String = "",            // website field name
        val category: String = "",       // android push format (fallback on pull)
        val date: String = "",
        val note: String = "",
        val type: String = "expense",
        val updatedAt: Long = 0L,
    )

    private fun WsExpense.toExpense(defaultType: String = "expense") = Expense(
        id          = jsonElemStr(id).ifBlank { System.currentTimeMillis().toString() },
        description = desc.ifBlank { description },
        amount      = amount,
        category    = cat.ifBlank { category }.ifBlank { "other" },
        date        = date,
        note        = note,
        type        = type.ifBlank { defaultType },
        updatedAt   = updatedAt.takeIf { it > 0 } ?: 0L,
    )

    private fun Expense.toWsExpense() = WsExpense(
        id        = JsonPrimitive(id),
        desc      = description,
        amount    = amount,
        cat       = category,
        date      = date,
        note      = note,
        type      = type,
        updatedAt = updatedAt,
    )

    private suspend fun pushExpenses() {
        val all = db.expenseDao().getAll().first()
        // Expenses (type="expense") → ls:homer-expenses
        val wsExp = all.filter { it.type != "income" }.map { it.toWsExpense() }
        supabase.setFieldState("ls:homer-expenses",
            json.encodeToString(ListSerializer(WsExpense.serializer()), wsExp))
        // Income (type="income") → ls:homer-income
        val wsInc = all.filter { it.type == "income" }.map { it.toWsExpense() }
        if (wsInc.isNotEmpty())
            supabase.setFieldState("ls:homer-income",
                json.encodeToString(ListSerializer(WsExpense.serializer()), wsInc))
        // Budgets → {category: limit} object (website format)
        val budgets = db.expenseDao().getAllBudgets().first()
        if (budgets.isNotEmpty()) {
            val budgetObj = buildJsonObject { budgets.forEach { b -> put(b.category, b.limit) } }
            supabase.setFieldState("ls:homer-expense-budgets", budgetObj.toString())
        }
    }

    private suspend fun pullExpenses() {
        // Cloud wins: fetch both expense + income arrays, then replace local entirely.
        val cloudExp = supabase.getFieldState("ls:homer-expenses")?.let { row ->
            if (row.value.isBlank()) return@let null
            json.decodeFromString(ListSerializer(WsExpense.serializer()), row.value)
                .map { it.toExpense("expense") }
        }
        val cloudInc = supabase.getFieldState("ls:homer-income")?.let { row ->
            if (row.value.isBlank()) return@let null
            json.decodeFromString(ListSerializer(WsExpense.serializer()), row.value)
                .map { it.toExpense("income") }
        }
        if (!cloudExp.isNullOrEmpty() || !cloudInc.isNullOrEmpty()) {
            db.expenseDao().clearAll()
            cloudExp?.let { if (it.isNotEmpty()) db.expenseDao().upsertAll(it) }
            cloudInc?.let { if (it.isNotEmpty()) db.expenseDao().upsertAll(it) }
        }
        // Pull budgets — website stores as {category: limit} object
        supabase.getFieldState("ls:homer-expense-budgets")?.let { row ->
            if (row.value.isBlank()) return@let
            val elem = try { json.parseToJsonElement(row.value) } catch (_: Exception) { return@let }
            val budgets: List<Budget> = when (elem) {
                is JsonObject -> elem.entries.mapNotNull { (cat, v) ->
                    val limit = (v as? JsonPrimitive)?.doubleOrNull ?: return@mapNotNull null
                    Budget(category = cat, limit = limit)
                }
                is JsonArray  -> runCatching {
                    json.decodeFromString(ListSerializer(Budget.serializer()), row.value)
                }.getOrElse { emptyList() }
                else -> emptyList()
            }
            if (budgets.isNotEmpty()) {
                db.expenseDao().clearAllBudgets()
                db.expenseDao().upsertBudgets(budgets)
            }
        }
    }

    // ── Habits ───────────────────────────────────────────────────────────────
    // Website key: "homer-habits"
    // Website format: { "habits": [{id, name, emoji, color, category, note, target, freq, archived, created}],
    //                   "completions": { "habitId:YYYY-MM-DD": true | number } }
    // Android: Habit(clientId, ...) + HabitCompletion(habitClientId, date, count)
    //   - website "id" (numeric string) ↔ android "clientId"
    //   - website "created" ↔ android "createdAt"
    //   - website "completions" key format: "id:date"

    @Serializable
    private data class WsHabit(
        val id: String = "",
        val name: String = "",
        val emoji: String = "",
        val color: String = "#3B82F6",
        val category: String = "",
        val freq: JsonElement = JsonPrimitive("daily"),
        val target: Int = 1,
        val note: String = "",
        val archived: Boolean = false,
        val created: Long = 0L,
    )

    @Serializable
    private data class WsHabitsBlob(
        val habits: List<WsHabit> = emptyList(),
        val completions: Map<String, JsonElement> = emptyMap(),
    )

    private suspend fun pushHabits() {
        val habits = db.habitDao().getAllHabits().first()
        // Get completions from the past 90 days
        val since = run {
            val cal = java.util.Calendar.getInstance()
            cal.add(java.util.Calendar.DAY_OF_YEAR, -90)
            "%04d-%02d-%02d".format(
                cal.get(java.util.Calendar.YEAR),
                cal.get(java.util.Calendar.MONTH) + 1,
                cal.get(java.util.Calendar.DAY_OF_MONTH)
            )
        }
        val completions = db.habitDao().getCompletionsSince(since).first()

        val wsHabits = habits.map { h ->
            WsHabit(
                id       = h.clientId,
                name     = h.name,
                emoji    = h.emoji,
                color    = h.color,
                category = h.category,
                freq     = JsonPrimitive(h.freq),
                target   = h.target,
                note     = h.note,
                archived = h.archived,
                created  = h.createdAt,
            )
        }
        val wsCompletions: Map<String, JsonElement> = completions.associate { c ->
            "${c.habitClientId}:${c.date}" to
                if (c.count > 1) JsonPrimitive(c.count) else JsonPrimitive(true)
        }

        val blob = WsHabitsBlob(habits = wsHabits, completions = wsCompletions)
        supabase.setFieldState("ls:homer-habits",
            json.encodeToString(WsHabitsBlob.serializer(), blob))
    }

    private suspend fun pullHabits() {
        supabase.getFieldState("ls:homer-habits")?.let { row ->
            if (row.value.isBlank()) return@let
            val blob = json.decodeFromString(WsHabitsBlob.serializer(), row.value)
            val habits = blob.habits.map { wh ->
                val clientId = wh.id.ifBlank {
                    wh.name.lowercase().replace(" ", "-") + "-" + wh.created
                }
                Habit(
                    clientId  = clientId,
                    name      = wh.name,
                    emoji     = wh.emoji,
                    color     = wh.color,
                    category  = wh.category,
                    freq      = when (val f = wh.freq) { is JsonPrimitive -> f.content; else -> "daily" },
                    target    = wh.target,
                    note      = wh.note,
                    archived  = wh.archived,
                    createdAt = wh.created.takeIf { it > 0 } ?: System.currentTimeMillis(),
                )
            }
            if (habits.isEmpty()) return@let  // safety: don't wipe local with empty cloud
            val knownIds = habits.map { it.clientId }.toSet()
            val completions = blob.completions.mapNotNull { (key, value) ->
                val colon = key.lastIndexOf(':')
                if (colon < 1) return@mapNotNull null
                val habitId = key.substring(0, colon)
                val date    = key.substring(colon + 1)
                if (habitId !in knownIds) return@mapNotNull null
                val count = when (value) {
                    is JsonPrimitive -> value.intOrNull ?: if (value.booleanOrNull == true) 1 else 0
                    else -> 1
                }
                if (count <= 0) null else HabitCompletion(habitClientId = habitId, date = date, count = count)
            }
            // Cloud wins: clear local, upsert cloud
            db.habitDao().clearAll()
            db.habitDao().clearAllCompletions()
            db.habitDao().upsertAll(habits)
            if (completions.isNotEmpty()) db.habitDao().upsertCompletions(completions)
        }
    }

    // ── Inbox ─────────────────────────────────────────────────────────────────
    // Website format: [{id, text, type, createdAt}] — matches Android InboxItem exactly.

    private suspend fun pushInbox() {
        val items = db.inboxDao().getAll().first()
        supabase.setFieldState("ls:homer-inbox",
            json.encodeToString(ListSerializer(InboxItem.serializer()), items))
    }

    private suspend fun pullInbox() {
        supabase.getFieldState("ls:homer-inbox")?.let { row ->
            if (row.value.isBlank()) return@let
            val items = json.decodeFromString(ListSerializer(InboxItem.serializer()), row.value)
            if (items.isEmpty()) return@let
            db.inboxDao().clearAll()
            db.inboxDao().upsertAll(items)
        }
    }

    // ── Links ─────────────────────────────────────────────────────────────────
    // Website key: "homer-links"
    // Website format: [{emoji, name, url, cat, useFavicon}]  — no "id", uses "cat" not "category"
    // Android: Link(id, name, url, category, emoji, useFavicon, order, updatedAt)
    //   - "cat" ↔ "category"
    //   - website has no id → derive a stable id from url+name hash

    @Serializable
    private data class WsLink(
        val emoji:      String  = "",
        val name:       String  = "",
        val url:        String  = "",
        val cat:        String  = "",
        val useFavicon: Boolean = true,
    )

    private suspend fun pushLinks() {
        val links = db.linkDao().getAll().first()
        if (links.isEmpty()) return
        val wsLinks = links.map { l ->
            WsLink(emoji = l.emoji, name = l.name, url = l.url,
                   cat = l.category, useFavicon = l.useFavicon)
        }
        supabase.setFieldState("ls:homer-links",
            json.encodeToString(ListSerializer(WsLink.serializer()), wsLinks))
    }

    private suspend fun pullLinks() {
        supabase.getFieldState("ls:homer-links")?.let { row ->
            if (row.value.isBlank()) return@let
            val wsLinks = json.decodeFromString(ListSerializer(WsLink.serializer()), row.value)
            if (wsLinks.isEmpty()) return@let
            val links = wsLinks.mapIndexed { idx, wl ->
                Link(
                    id         = stableId(wl.url, wl.name),
                    name       = wl.name,
                    url        = wl.url,
                    category   = wl.cat,
                    emoji      = wl.emoji,
                    useFavicon = wl.useFavicon,
                    order      = idx,
                )
            }
            db.linkDao().deleteAll()
            db.linkDao().upsertAll(links)
        }
    }

    // ── Pomodoro tasks ────────────────────────────────────────────────────────
    // Website key: "pom.tasks.v1"  (NOT "homer-pomodoro-tasks"!)
    // Website format: [{text, done, ts}]  — no "id"
    // Android: PomodoroTask(id, text, done, createdAt, updatedAt)
    //   - "ts" ↔ "createdAt"; use ts.toString() as id

    @Serializable
    private data class WsTask(
        val text: String  = "",
        val done: Boolean = false,
        val ts:   Long    = 0L,
    )

    private suspend fun pushPomodoroTasks() {
        val tasks = db.pomodoroDao().getAllTasks().first()
        val wsTasks = tasks.map { t -> WsTask(text = t.text, done = t.done, ts = t.createdAt) }
        supabase.setFieldState("ls:pom-tasks",
            json.encodeToString(ListSerializer(WsTask.serializer()), wsTasks))
    }

    private suspend fun pullPomodoroTasks() {
        supabase.getFieldState("ls:pom-tasks")?.let { row ->
            if (row.value.isBlank()) return@let
            val wsTasks = json.decodeFromString(ListSerializer(WsTask.serializer()), row.value)
            if (wsTasks.isEmpty()) return@let
            val tasks = wsTasks.map { wt ->
                PomodoroTask(
                    id        = wt.ts.toString().ifBlank { System.currentTimeMillis().toString() },
                    text      = wt.text,
                    done      = wt.done,
                    createdAt = wt.ts,
                    updatedAt = wt.ts,
                )
            }
            db.pomodoroDao().clearAllTasks()
            db.pomodoroDao().upsertAllTasks(tasks)
        }
    }

    // ── Notes ─────────────────────────────────────────────────────────────────
    // Website key: "homer-notes"
    // Android format:  [{id, title, content, emoji, parentId, pinned, createdAt (Long), updatedAt (Long)}]
    // Old web format:  [{id, title, content, daily, date, created (ISO string), updated (ISO string)}]
    // Bridge WsNote handles both — prefers Long fields, falls back to ISO string conversion.

    @Serializable
    private data class WsNote(
        val id:        String  = "",
        val title:     String  = "",
        val content:   String  = "",
        val emoji:     String  = "📝",
        val parentId:  String? = null,
        val pinned:    Boolean = false,
        // Android-format timestamps (Long ms since epoch)
        val createdAt: Long    = 0L,
        val updatedAt: Long    = 0L,
        // Old web-format timestamps (ISO-8601 string)
        val created:   String  = "",
        val updated:   String  = "",
    )

    /** Parse ISO-8601 string to epoch millis; returns System.currentTimeMillis() on failure. */
    private fun parseIsoMs(iso: String): Long =
        if (iso.isBlank()) System.currentTimeMillis()
        else try { Instant.parse(iso).toEpochMilli() } catch (_: Exception) { System.currentTimeMillis() }

    private fun WsNote.toNote(): Note {
        // Take the MAX of both timestamp formats so web edits (which update the ISO `updated`
        // field) are not silently discarded when an older Android `updatedAt` Long is present.
        val tsLong    = updatedAt.takeIf { it > 0 } ?: 0L
        val tsIso     = if (updated.isNotBlank()) parseIsoMs(updated) else 0L
        val ts        = maxOf(tsLong, tsIso).takeIf { it > 0 } ?: System.currentTimeMillis()
        val cLong     = createdAt.takeIf { it > 0 } ?: 0L
        val cIso      = if (created.isNotBlank()) parseIsoMs(created) else 0L
        val tsCreated = maxOf(cLong, cIso).takeIf { it > 0 } ?: ts
        return Note(
            id        = id,
            title     = title.ifBlank { "Untitled" },
            content   = content,
            emoji     = emoji,
            parentId  = parentId,
            pinned    = pinned,
            createdAt = tsCreated,
            updatedAt = ts,
        )
    }

    private suspend fun pushNotes() {
        val notes = db.noteDao().getAll().first()
        if (notes.isEmpty()) return   // safety: never wipe cloud with empty local
        supabase.setFieldState("ls:homer-notes",
            json.encodeToString(ListSerializer(Note.serializer()), notes))
    }

    private suspend fun pullNotes() {
        supabase.getFieldState("ls:homer-notes")?.let { row ->
            if (row.value.isBlank()) return@let
            val wsNotes = json.decodeFromString(ListSerializer(WsNote.serializer()), row.value)
            val cloudNotes = wsNotes.filter { it.id.isNotBlank() }.map { it.toNote() }
            if (cloudNotes.isEmpty()) return@let
            db.noteDao().clearAll()
            db.noteDao().upsertAll(cloudNotes)
        }
    }

    // ── Journal ───────────────────────────────────────────────────────────────
    // Website key: "homer-journal" → Supabase field_id: "ls:homer-journal"
    // Format: [{id, date, content, mood, moodLabel, aiReflection, wordCount, createdAt, updatedAt}]

    private suspend fun pushJournal() {
        val entries = db.journalDao().getAll().first()
        if (entries.isEmpty()) return
        supabase.setFieldState("ls:homer-journal",
            json.encodeToString(ListSerializer(JournalEntry.serializer()), entries))
    }

    private suspend fun pullJournal() {
        supabase.getFieldState("ls:homer-journal")?.let { row ->
            if (row.value.isBlank()) return@let
            val cloudEntries = json.decodeFromString(ListSerializer(JournalEntry.serializer()), row.value)
            if (cloudEntries.isEmpty()) return@let
            db.journalDao().clearAll()
            db.journalDao().upsertAll(cloudEntries)
        }
    }

    // ── Car ───────────────────────────────────────────────────────────────────
    // Website key: "homer-car" → Supabase field_id: "ls:homer-car"
    // Format: {vehicles:[...], documents:[...], maintenance:[...], fuel:[...]}

    @Serializable
    private data class CarBlob(
        val vehicles:    List<CarVehicle>     = emptyList(),
        val documents:   List<CarDocument>    = emptyList(),
        val maintenance: List<CarMaintenance> = emptyList(),
        val fuel:        List<CarFuelLog>     = emptyList(),
    )

    private suspend fun pushCar() {
        val blob = CarBlob(
            vehicles    = db.carDao().getVehicles().first(),
            documents   = db.carDao().getAllDocuments().first(),
            maintenance = db.carDao().getAllMaintenance().first(),
            fuel        = db.carDao().getAllFuelLog().first(),
        )
        supabase.setFieldState("ls:homer-car", json.encodeToString(CarBlob.serializer(), blob))
    }

    private suspend fun pullCar() {
        supabase.getFieldState("ls:homer-car")?.let { row ->
            if (row.value.isBlank()) return@let
            val blob = json.decodeFromString(CarBlob.serializer(), row.value)
            if (blob.vehicles.isEmpty() && blob.documents.isEmpty() &&
                blob.maintenance.isEmpty() && blob.fuel.isEmpty()) return@let
            // Cloud wins: clear all, upsert cloud
            db.carDao().clearAllVehicles()
            db.carDao().clearAllDocuments()
            db.carDao().clearAllMaintenance()
            db.carDao().clearAllFuelLog()
            if (blob.vehicles.isNotEmpty())    db.carDao().upsertVehicles(blob.vehicles)
            if (blob.documents.isNotEmpty())   db.carDao().upsertDocuments(blob.documents)
            if (blob.maintenance.isNotEmpty()) db.carDao().upsertMaintenanceAll(blob.maintenance)
            if (blob.fuel.isNotEmpty())        db.carDao().upsertFuelLogAll(blob.fuel)
        }
    }

    // ── Kanban ────────────────────────────────────────────────────────────────
    // Field ID: "ls:homer-kanban" (matches web convention)
    // Android push format: {projects:[KanbanProject...], tasks:[KanbanTask...]}
    // Web vault format:    {projects:[...], goals:[{id(int), col, summary, notes, due, ...}]}
    // Bridge classes handle both — col/column, due/dueDate, goals/tasks, int/UUID ids.

    // Tolerates both Android format (tasks) and web vault format (goals, col, due, int ids)
    @Serializable
    private data class WsKanbanTask(
        val id: JsonElement = JsonPrimitive(""),
        val col: String = "",           // web format
        val column: String = "",        // android format
        val summary: String = "",
        val notes: String = "",         // web "description"
        val description: String = "",   // android format
        val due: String = "",           // web format
        val dueDate: String = "",       // android format
        val priority: String = "medium",
        val projectId: JsonElement = JsonPrimitive(""),
        val labels: JsonElement = JsonArray(emptyList()),
        val labelsJson: String = "[]",
        val subtasks: JsonElement = JsonArray(emptyList()),
        val subtasksJson: String = "[]",
        val attachments: JsonElement = JsonArray(emptyList()),
        val attachmentsJson: String = "[]",
        val archived: Boolean = false,
        val backlog: Boolean = false,
        val order: Int = 0,
        val updatedAt: Long = 0L,
    )

    @Serializable
    private data class WsKanbanProject(
        val id: JsonElement = JsonPrimitive(""),
        val name: String = "",
        val key: String = "",
        val description: String = "",
        val icon: String = "",
        val color: String = "#3B82F6",
        val customFieldsJson: String = "[]",
        val archived: Boolean = false,
        val updatedAt: Long = 0L,
    )

    @Serializable
    private data class KanbanBlobWs(
        val projects: List<WsKanbanProject> = emptyList(),
        val tasks: List<WsKanbanTask> = emptyList(),  // android push uses "tasks"
        val goals: List<WsKanbanTask> = emptyList(),  // web vault push uses "goals"
    )

    private fun jsonElemStr(e: JsonElement): String =
        when (e) {
            is JsonPrimitive -> e.contentOrNull ?: e.content
            else -> e.toString()
        }

    private fun strToJsonArray(s: String): JsonArray =
        runCatching { json.parseToJsonElement(s) as? JsonArray }.getOrNull() ?: JsonArray(emptyList())

    private fun WsKanbanTask.toTask(): KanbanTask {
        val taskId     = jsonElemStr(id).ifBlank { UUID.randomUUID().toString() }
        val colVal     = column.ifBlank { col }.ifBlank { "todo" }
        val dueVal     = dueDate.ifBlank { due }
        val desc       = description.ifBlank { notes }
        val projId     = jsonElemStr(projectId)
        val labelsStr  = if (labelsJson != "[]") labelsJson else (labels as? JsonArray)?.toString() ?: "[]"
        val subStr     = if (subtasksJson != "[]") subtasksJson else (subtasks as? JsonArray)?.toString() ?: "[]"
        val attachStr  = if (attachmentsJson != "[]") attachmentsJson else (attachments as? JsonArray)?.toString() ?: "[]"
        return KanbanTask(
            id              = taskId,
            projectId       = projId,
            summary         = summary,
            description     = desc,
            column          = colVal,
            priority        = priority,
            labelsJson      = labelsStr,
            dueDate         = dueVal,
            subtasksJson    = subStr,
            attachmentsJson = attachStr,
            order           = order,
            archived        = archived,
            backlog         = backlog,
            updatedAt       = updatedAt.takeIf { it > 0 } ?: System.currentTimeMillis(),
        )
    }

    private fun WsKanbanProject.toProject(): KanbanProject {
        val projId = jsonElemStr(id).ifBlank { UUID.randomUUID().toString() }
        return KanbanProject(
            id               = projId,
            name             = name.ifBlank { "Project" },
            key              = key.ifBlank { name.take(3).uppercase() },
            description      = description,
            icon             = icon,
            color            = color,
            customFieldsJson = customFieldsJson,
            archived         = archived,
            updatedAt        = updatedAt.takeIf { it > 0 } ?: System.currentTimeMillis(),
        )
    }

    private suspend fun pushKanban() {
        val projects = db.kanbanDao().getAllProjects().first()
        val tasks    = db.kanbanDao().getAllTasks().first()
        if (projects.isEmpty() && tasks.isEmpty()) return   // never wipe cloud with empty local
        // Push in website-compatible format so both sides can merge correctly
        val wsProjects = projects.map { p ->
            WsKanbanProject(
                id               = JsonPrimitive(p.id),
                name             = p.name,
                key              = p.key,
                description      = p.description,
                icon             = p.icon,
                color            = p.color,
                customFieldsJson = p.customFieldsJson,
                archived         = p.archived,
                updatedAt        = p.updatedAt,
            )
        }
        val wsTasks = tasks.map { t ->
            WsKanbanTask(
                id          = JsonPrimitive(t.id),
                col         = t.column,
                summary     = t.summary,
                notes       = t.description,
                due         = t.dueDate,
                priority    = t.priority,
                projectId   = JsonPrimitive(t.projectId),
                labels      = strToJsonArray(t.labelsJson),
                subtasks    = strToJsonArray(t.subtasksJson),
                attachments = strToJsonArray(t.attachmentsJson),
                order       = t.order,
                archived    = t.archived,
                backlog     = t.backlog,
                updatedAt   = t.updatedAt,
            )
        }
        val blob = KanbanBlobWs(projects = wsProjects, tasks = wsTasks)
        supabase.setFieldState("ls:homer-kanban", json.encodeToString(KanbanBlobWs.serializer(), blob))
    }

    private suspend fun pullKanban() {
        supabase.getFieldState("ls:homer-kanban")?.let { row ->
            if (row.value.isBlank()) return@let
            val blob     = json.decodeFromString(KanbanBlobWs.serializer(), row.value)
            // Union tasks + goals, then deduplicate by id (prevents duplication if both keys exist)
            val allTasks = (blob.tasks + blob.goals).distinctBy { jsonElemStr(it.id) }
            val projects = blob.projects.map { it.toProject() }
            val tasks    = allTasks.map { it.toTask() }
            if (projects.isEmpty() && tasks.isEmpty()) return@let
            // Cloud wins: clear all, upsert cloud
            db.kanbanDao().clearAllProjects()
            db.kanbanDao().clearAllTasks()
            if (projects.isNotEmpty()) db.kanbanDao().upsertProjects(projects)
            if (tasks.isNotEmpty())    db.kanbanDao().upsertTasks(tasks)
        }
    }

    // ── Life Goals ────────────────────────────────────────────────────────────
    // Field ID: "ls:homer-life-goals" (matches web convention)
    // Android format: {id(UUID), title, description, category, icon, targetDate, milestonesJson, status, progress, updatedAt}
    // Web vault format: {id(int), title, description, category, icon, targetDate, milestones:[{text,done}], progress, updatedAt}
    // WsLifeGoal bridge handles both.

    @Serializable
    private data class WsLifeGoal(
        val id: JsonElement = JsonPrimitive(""),
        val title: String = "",
        val description: String = "",
        val category: String = "",
        val icon: String = "",
        val targetDate: String = "",
        val milestones: JsonElement = JsonArray(emptyList()),  // web format: array
        val milestonesJson: String = "[]",                     // android format: JSON string
        val status: String = "active",
        val progress: Int = 0,
        val updatedAt: Long = 0L,
    )

    private fun WsLifeGoal.toLifeGoal(): LifeGoal {
        val lgId  = jsonElemStr(id).ifBlank { UUID.randomUUID().toString() }
        val msJson = milestonesJson.takeIf { it != "[]" } ?: (milestones as? JsonArray)?.toString() ?: "[]"
        return LifeGoal(
            id            = lgId,
            title         = title,
            description   = description,
            category      = category,
            icon          = icon,
            targetDate    = targetDate,
            milestonesJson = msJson,
            status        = status,
            progress      = progress,
            updatedAt     = updatedAt.takeIf { it > 0 } ?: System.currentTimeMillis(),
        )
    }

    private suspend fun pushLifeGoals() {
        val goals = db.lifeGoalDao().getAll().first()
        if (goals.isEmpty()) return   // never wipe cloud with empty local
        // Push in website-compatible format: milestones as array, not milestonesJson string
        val wsGoals = goals.map { g ->
            WsLifeGoal(
                id          = JsonPrimitive(g.id),
                title       = g.title,
                description = g.description,
                category    = g.category,
                icon        = g.icon,
                targetDate  = g.targetDate,
                milestones  = strToJsonArray(g.milestonesJson),
                status      = g.status,
                progress    = g.progress,
                updatedAt   = g.updatedAt,
            )
        }
        supabase.setFieldState("ls:homer-life-goals",
            json.encodeToString(ListSerializer(WsLifeGoal.serializer()), wsGoals))
    }

    private suspend fun pullLifeGoals() {
        supabase.getFieldState("ls:homer-life-goals")?.let { row ->
            if (row.value.isBlank()) return@let
            val wsGoals = json.decodeFromString(ListSerializer(WsLifeGoal.serializer()), row.value)
            val goals   = wsGoals.map { it.toLifeGoal() }
            if (goals.isEmpty()) return@let
            db.lifeGoalDao().clearAll()
            db.lifeGoalDao().upsertAll(goals)
        }
    }

    // ── Focus Lab — brain dump & zen goal ─────────────────────────────────────
    // Stored as plain text strings in AppSetting table.
    // Web keys: "homer-brain-dump" → "ls:homer-brain-dump", "homer-zen-goal" → "ls:homer-zen-goal"

    private suspend fun pushBrainDump() {
        val text = db.appSettingDao().get("homer-brain-dump") ?: return
        supabase.setFieldState("ls:homer-brain-dump", text)
    }

    private suspend fun pullBrainDump() {
        supabase.getFieldState("ls:homer-brain-dump")?.let { row ->
            if (row.value.isBlank()) return@let
            db.appSettingDao().set(AppSetting("homer-brain-dump", row.value))
        }
    }

    private suspend fun pushZenGoal() {
        val text = db.appSettingDao().get("homer-zen-goal") ?: return
        supabase.setFieldState("ls:homer-zen-goal", text)
    }

    private suspend fun pullZenGoal() {
        supabase.getFieldState("ls:homer-zen-goal")?.let { row ->
            if (row.value.isBlank()) return@let
            db.appSettingDao().set(AppSetting("homer-zen-goal", row.value))
        }
    }

    // ── Expense Goals ─────────────────────────────────────────────────────────
    // Website key: "homer-expense-goals" → [{id: number, name, target, saved, color}]
    // Android: stored as AppSetting JSON blob (no dedicated entity needed)

    private suspend fun pushExpenseGoals() {
        val text = db.appSettingDao().get("homer-expense-goals") ?: return
        if (text.isBlank()) return
        supabase.setFieldState("ls:homer-expense-goals", text)
    }

    private suspend fun pullExpenseGoals() {
        supabase.getFieldState("ls:homer-expense-goals")?.let { row ->
            if (row.value.isBlank()) return@let
            db.appSettingDao().set(AppSetting("homer-expense-goals", row.value))
        }
    }

    // ── Calendar Events ───────────────────────────────────────────────────────
    // Website key: "homer-cal-events" → [{id, title, date, time, location, description, category}]
    // Android: CalendarEvent(id, title, start(Long), end(Long), location, description, icsSource, allDay)
    // Only manual events (icsSource == "") are synced; ICS-feed events are ignored.

    @Serializable
    private data class WsCalEvent(
        val id: String = "",
        val title: String = "",
        val date: String = "",        // "YYYY-MM-DD"
        val time: String = "",        // "HH:mm" or "" for all-day
        val location: String = "",
        val description: String = "",
        val category: String = "",
    )

    private fun calDateTimeToMs(date: String, time: String): Long = try {
        if (time.isBlank()) {
            java.time.LocalDate.parse(date)
                .atStartOfDay(java.time.ZoneId.systemDefault())
                .toInstant().toEpochMilli()
        } else {
            val t = if (time.length == 5) "$time:00" else time
            java.time.LocalDateTime.parse("${date}T$t")
                .atZone(java.time.ZoneId.systemDefault())
                .toInstant().toEpochMilli()
        }
    } catch (_: Exception) { System.currentTimeMillis() }

    private fun msToCalDate(ms: Long): String =
        java.time.Instant.ofEpochMilli(ms)
            .atZone(java.time.ZoneId.systemDefault())
            .toLocalDate().toString()

    private fun msToCalTime(ms: Long, allDay: Boolean): String {
        if (allDay) return ""
        val lt = java.time.Instant.ofEpochMilli(ms)
            .atZone(java.time.ZoneId.systemDefault()).toLocalTime()
        return "%02d:%02d".format(lt.hour, lt.minute)
    }

    private fun WsCalEvent.toCalendarEvent(): CalendarEvent {
        val startMs = calDateTimeToMs(date, time)
        return CalendarEvent(
            id          = id.ifBlank { startMs.toString() },
            title       = title,
            start       = startMs,
            end         = startMs + 3_600_000L,
            location    = location,
            description = description,
            icsSource   = "",
            allDay      = time.isBlank(),
        )
    }

    private suspend fun pushCalendarEvents() {
        val events = db.calendarDao().getManualEvents().first()
        if (events.isEmpty()) return
        val wsEvents = events.map { e ->
            WsCalEvent(
                id          = e.id,
                title       = e.title,
                date        = msToCalDate(e.start),
                time        = msToCalTime(e.start, e.allDay),
                location    = e.location,
                description = e.description,
                category    = "",
            )
        }
        supabase.setFieldState("ls:homer-cal-events",
            json.encodeToString(ListSerializer(WsCalEvent.serializer()), wsEvents))
    }

    private suspend fun pullCalendarEvents() {
        supabase.getFieldState("ls:homer-cal-events")?.let { row ->
            if (row.value.isBlank()) return@let
            val wsEvents = json.decodeFromString(ListSerializer(WsCalEvent.serializer()), row.value)
            val cloudEvents = wsEvents.filter { it.id.isNotBlank() && it.date.isNotBlank() }
                .map { it.toCalendarEvent() }
            if (cloudEvents.isEmpty()) return@let
            db.calendarDao().clearManualEvents()
            db.calendarDao().upsertAll(cloudEvents)
        }
    }

    // ── Conflict detection ────────────────────────────────────────────────────

    /**
     * Fetch cloud counts for each synced field and compare to local Room counts.
     * Returns one [ConflictInfo] per field where the counts differ and cloud is non-empty.
     * Call this before pulling to decide whether to prompt the user for resolution.
     */
    suspend fun detectConflicts(): List<ConflictInfo> {
        supabase.ensureSignedIn()
        val uid = supabase.userId
            ?: throw Exception("Not authenticated with Supabase — sign-in failed or credentials missing")
        Log.d("HomerSync", "detectConflicts: uid=$uid isBogdan=${supabase.isBogdan()}")
        if (!supabase.isBogdan()) return emptyList()
        val result = mutableListOf<ConflictInfo>()

        // Only flag a conflict when BOTH sides have data and counts differ.
        // If local == 0 (fresh install / empty db), just pull automatically — no dialog needed.
        fun add(key: String, label: String, emoji: String, local: Int, cloud: Int) {
            if (cloud > 0 && local > 0 && local != cloud) result += ConflictInfo(key, label, emoji, local, cloud)
        }

        runCatching {
            val local = db.expenseDao().getAll().first().count { it.type != "income" }
            val cloud = supabase.getFieldState("ls:homer-expenses")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(ListSerializer(WsExpense.serializer()), row.value).size
            } ?: 0
            add("ls:homer-expenses", "Expenses", "💰", local, cloud)
        }

        runCatching {
            val local = db.habitDao().getAllHabits().first().size
            val cloud = supabase.getFieldState("ls:homer-habits")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(WsHabitsBlob.serializer(), row.value).habits.size
            } ?: 0
            add("ls:homer-habits", "Habits", "✅", local, cloud)
        }

        runCatching {
            val local = db.inboxDao().getAll().first().size
            val cloud = supabase.getFieldState("ls:homer-inbox")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(ListSerializer(InboxItem.serializer()), row.value).size
            } ?: 0
            add("ls:homer-inbox", "Inbox", "📥", local, cloud)
        }

        runCatching {
            val local = db.linkDao().getAll().first().size
            val cloud = supabase.getFieldState("ls:homer-links")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(ListSerializer(WsLink.serializer()), row.value).size
            } ?: 0
            add("ls:homer-links", "Links", "🔗", local, cloud)
        }

        runCatching {
            val local = db.noteDao().getAll().first().size
            val cloud = supabase.getFieldState("ls:homer-notes")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(ListSerializer(Note.serializer()), row.value).size
            } ?: 0
            add("ls:homer-notes", "Notes", "📝", local, cloud)
        }

        runCatching {
            val local = db.journalDao().getAll().first().size
            val cloud = supabase.getFieldState("ls:homer-journal")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(ListSerializer(JournalEntry.serializer()), row.value).size
            } ?: 0
            add("ls:homer-journal", "Journal", "📔", local, cloud)
        }

        runCatching {
            val local = db.kanbanDao().getAllProjects().first().size
            val cloud = supabase.getFieldState("ls:homer-kanban")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(KanbanBlobWs.serializer(), row.value).projects.size
            } ?: 0
            add("ls:homer-kanban", "Projects & Tasks", "📋", local, cloud)
        }

        runCatching {
            val local = db.lifeGoalDao().getAll().first().size
            val cloud = supabase.getFieldState("ls:homer-life-goals")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(ListSerializer(WsLifeGoal.serializer()), row.value).size
            } ?: 0
            add("ls:homer-life-goals", "Life Goals", "🎯", local, cloud)
        }

        runCatching {
            val local = db.carDao().getVehicles().first().size
            val cloud = supabase.getFieldState("ls:homer-car")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(CarBlob.serializer(), row.value).vehicles.size
            } ?: 0
            add("ls:homer-car", "Car Data", "🚗", local, cloud)
        }

        runCatching {
            val local = db.calendarDao().getManualEvents().first().size
            val cloud = supabase.getFieldState("ls:homer-cal-events")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(ListSerializer(WsCalEvent.serializer()), row.value).size
            } ?: 0
            add("ls:homer-cal-events", "Calendar Events", "📅", local, cloud)
        }

        runCatching {
            val local = db.quoteDao().getAllSavedAt().size
            val cloud = supabase.getFieldState("ls:savedQuotes")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(ListSerializer(WsQuote.serializer()), row.value).size
            } ?: 0
            add("ls:savedQuotes", "Saved Quotes", "💬", local, cloud)
        }

        runCatching {
            val local = db.pomodoroDao().getAllSessionTs().size
            val cloud = supabase.getFieldState("ls:homer-sessions")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(ListSerializer(WsSession.serializer()), row.value).size
            } ?: 0
            add("ls:homer-sessions", "Focus Sessions", "🍅", local, cloud)
        }

        runCatching {
            val local = db.reminderDao().getAllSync().size
            val cloud = supabase.getFieldState("ls:homer-reminders")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(ListSerializer(Reminder.serializer()), row.value).size
            } ?: 0
            add("ls:homer-reminders", "Reminders", "🔔", local, cloud)
        }

        return result
    }

    /**
     * Pull all synced fields applying per-field [SyncResolution] decisions.
     * Fields not present in [resolutions] default to [SyncResolution.MERGE_BOTH].
     *  - KEEP_LOCAL → push local to cloud; skip pull.
     *  - MERGE_BOTH → upsert cloud into local (safe, no deletions).
     *  - USE_CLOUD  → clear local table first, then pull from cloud.
     */
    suspend fun pullWithResolutions(resolutions: Map<String, SyncResolution>) {
        supabase.ensureSignedIn()
        val uid = supabase.userId
            ?: throw Exception("Not authenticated with Supabase — sign-in failed or credentials missing")
        if (!supabase.isBogdan()) throw Exception("Signed in as non-Bogdan user (id=$uid)")

        suspend fun apply(
            key: String,
            clearFn: suspend () -> Unit,
            pullFn: suspend () -> Unit,
            pushFn: suspend () -> Unit,
        ) = when (resolutions[key] ?: SyncResolution.MERGE_BOTH) {
            SyncResolution.KEEP_LOCAL -> pushFn()
            SyncResolution.USE_CLOUD  -> { clearFn(); pullFn() }
            SyncResolution.MERGE_BOTH -> pullFn()
        }

        runCatching {
            apply("ls:homer-expenses",
                clearFn = { db.expenseDao().clearAll(); db.expenseDao().clearAllBudgets() },
                pullFn  = ::pullExpenses,
                pushFn  = ::pushExpenses)
        }.onFailure { Log.e("HomerSync", "expenses resolution failed", it) }

        runCatching {
            apply("ls:homer-habits",
                clearFn = { db.habitDao().clearAll(); db.habitDao().clearAllCompletions() },
                pullFn  = ::pullHabits,
                pushFn  = ::pushHabits)
        }.onFailure { Log.e("HomerSync", "habits resolution failed", it) }

        runCatching {
            apply("ls:homer-inbox",
                clearFn = { db.inboxDao().clearAll() },
                pullFn  = ::pullInbox,
                pushFn  = ::pushInbox)
        }.onFailure { Log.e("HomerSync", "inbox resolution failed", it) }

        runCatching {
            apply("ls:homer-links",
                clearFn = { db.linkDao().deleteAll() },
                pullFn  = ::pullLinks,
                pushFn  = ::pushLinks)
        }.onFailure { Log.e("HomerSync", "links resolution failed", it) }

        runCatching {
            apply("ls:pom-tasks",
                clearFn = { db.pomodoroDao().clearAllTasks() },
                pullFn  = ::pullPomodoroTasks,
                pushFn  = ::pushPomodoroTasks)
        }.onFailure { Log.e("HomerSync", "tasks resolution failed", it) }

        runCatching {
            apply("ls:homer-notes",
                clearFn = { db.noteDao().clearAll() },
                pullFn  = ::pullNotes,
                pushFn  = ::pushNotes)
        }.onFailure { Log.e("HomerSync", "notes resolution failed", it) }

        runCatching {
            apply("ls:homer-journal",
                clearFn = { db.journalDao().clearAll() },
                pullFn  = ::pullJournal,
                pushFn  = ::pushJournal)
        }.onFailure { Log.e("HomerSync", "journal resolution failed", it) }

        runCatching {
            apply("ls:homer-car",
                clearFn = {
                    db.carDao().clearAllVehicles()
                    db.carDao().clearAllDocuments()
                    db.carDao().clearAllMaintenance()
                    db.carDao().clearAllFuelLog()
                },
                pullFn  = ::pullCar,
                pushFn  = ::pushCar)
        }.onFailure { Log.e("HomerSync", "car resolution failed", it) }

        runCatching {
            apply("ls:homer-kanban",
                clearFn = { db.kanbanDao().clearAllProjects(); db.kanbanDao().clearAllTasks() },
                pullFn  = ::pullKanban,
                pushFn  = ::pushKanban)
        }.onFailure { Log.e("HomerSync", "kanban resolution failed", it) }

        runCatching {
            apply("ls:homer-life-goals",
                clearFn = { db.lifeGoalDao().clearAll() },
                pullFn  = ::pullLifeGoals,
                pushFn  = ::pushLifeGoals)
        }.onFailure { Log.e("HomerSync", "life-goals resolution failed", it) }

        runCatching {
            apply("ls:homer-expense-goals",
                clearFn = { db.appSettingDao().set(AppSetting("homer-expense-goals", "[]")) },
                pullFn  = ::pullExpenseGoals,
                pushFn  = ::pushExpenseGoals)
        }.onFailure { Log.e("HomerSync", "expense-goals resolution failed", it) }

        runCatching {
            apply("ls:homer-cal-events",
                clearFn = { db.calendarDao().clearManualEvents() },
                pullFn  = ::pullCalendarEvents,
                pushFn  = ::pushCalendarEvents)
        }.onFailure { Log.e("HomerSync", "cal-events resolution failed", it) }

        runCatching {
            apply("ls:savedQuotes",
                clearFn = { db.quoteDao().deleteAll() },
                pullFn  = ::pullSavedQuotes,
                pushFn  = ::pushSavedQuotes)
        }.onFailure { Log.e("HomerSync", "savedQuotes resolution failed", it) }

        // Blob fields — clearFn resets the AppSetting to empty
        runCatching {
            apply("ls:pom-settings",
                clearFn = { db.appSettingDao().set(AppSetting("pom.settings.v1", "")) },
                pullFn  = ::pullPomSettings,
                pushFn  = ::pushPomSettings)
        }.onFailure { Log.e("HomerSync", "pom-settings resolution failed", it) }

        runCatching {
            apply("ls:homer-expense-templates",
                clearFn = { db.appSettingDao().set(AppSetting("homer-expense-templates", "[]")) },
                pullFn  = ::pullExpenseTemplates,
                pushFn  = ::pushExpenseTemplates)
        }.onFailure { Log.e("HomerSync", "expense-templates resolution failed", it) }

        runCatching {
            apply("ls:homer-expense-cats",
                clearFn = { db.appSettingDao().set(AppSetting("homer-expense-cats", "[]")) },
                pullFn  = ::pullExpenseCats,
                pushFn  = ::pushExpenseCats)
        }.onFailure { Log.e("HomerSync", "expense-cats resolution failed", it) }

        runCatching {
            apply("ls:homer-recurring",
                clearFn = { db.appSettingDao().set(AppSetting("homer-recurring", "[]")) },
                pullFn  = ::pullRecurring,
                pushFn  = ::pushRecurring)
        }.onFailure { Log.e("HomerSync", "recurring resolution failed", it) }

        runCatching {
            apply("ls:homer-weekly-reviews",
                clearFn = { db.appSettingDao().set(AppSetting("homer-weekly-reviews", "[]")) },
                pullFn  = ::pullWeeklyReviews,
                pushFn  = ::pushWeeklyReviews)
        }.onFailure { Log.e("HomerSync", "weekly-reviews resolution failed", it) }

        runCatching {
            apply("ls:homer-countdown",
                clearFn = {
                    ctx.getSharedPreferences("homer_countdown", Context.MODE_PRIVATE)
                        .edit().remove("name").remove("dateMs").apply()
                },
                pullFn  = ::pullCountdown,
                pushFn  = ::pushCountdown)
        }.onFailure { Log.e("HomerSync", "countdown resolution failed", it) }

        runCatching {
            apply("ls:homer-secrets",
                clearFn = { db.vaultDao().clearAllCredentials() },
                pullFn  = ::pullSecrets,
                pushFn  = ::pushSecrets)
        }.onFailure { Log.e("HomerSync", "secrets resolution failed", it) }

        runCatching {
            apply("ls:homer-vault-notes",
                clearFn = { /* notes are upserted by mode, no full clear needed */ },
                pullFn  = ::pullVaultNotes,
                pushFn  = ::pushVaultNotes)
        }.onFailure { Log.e("HomerSync", "vault-notes resolution failed", it) }

        runCatching {
            apply("ls:homer-reminders",
                clearFn = { db.reminderDao().clearAll() },
                pullFn  = ::pullReminders,
                pushFn  = ::pushReminders)
        }.onFailure { Log.e("HomerSync", "reminders resolution failed", it) }
    }

    // ── Saved Quotes ──────────────────────────────────────────────────────────
    // Website key: "motivator.savedQuotes.v1" → Supabase field_id: "ls:savedQuotes"
    // Website format: [{q, a, ts}]  — short keys used by website renderSaved/buildMarkdown
    // Old Android format: [{text, author, savedAt}]  — kept as fallback fields for backwards compat

    @Serializable
    private data class WsQuote(
        val q: String = "",          // website format (primary)
        val a: String = "",          // website format (primary)
        val ts: Long = 0L,           // website format (primary)
        val text: String = "",       // old android format (fallback)
        val author: String = "",     // old android format (fallback)
        val savedAt: Long = 0L,      // old android format (fallback)
    )

    private fun WsQuote.toSavedQuote(): SavedQuote {
        val resolvedText   = q.ifBlank { text }
        val resolvedAuthor = a.ifBlank { author }.ifBlank { "Unknown" }
        val resolvedTs     = ts.takeIf { it > 0 } ?: savedAt.takeIf { it > 0 } ?: System.currentTimeMillis()
        return SavedQuote(text = resolvedText, author = resolvedAuthor, savedAt = resolvedTs)
    }

    private suspend fun pushSavedQuotes() {
        val quotes = db.quoteDao().getAll().first()
        if (quotes.isEmpty()) return
        // Push in website format {q, a, ts} so website renderSaved() displays correctly
        val ws = quotes.map { q -> WsQuote(q = q.text, a = q.author, ts = q.savedAt) }
        supabase.setFieldState("ls:savedQuotes",
            json.encodeToString(ListSerializer(WsQuote.serializer()), ws))
    }

    private suspend fun pullSavedQuotes() {
        supabase.getFieldState("ls:savedQuotes")?.let { row ->
            if (row.value.isBlank()) return@let
            val wsQuotes = json.decodeFromString(ListSerializer(WsQuote.serializer()), row.value)
            val cloudQuotes = wsQuotes.map { it.toSavedQuote() }.filter { it.text.isNotBlank() }
            if (cloudQuotes.isEmpty()) return@let
            // Merge: union of local + cloud, dedup by lowercased text, keep most recent
            val localQuotes = db.quoteDao().getAll().first()
            val merged = mutableMapOf<String, SavedQuote>()
            for (q in cloudQuotes) merged[q.text.trim().lowercase()] = q
            for (q in localQuotes) {
                val key = q.text.trim().lowercase()
                val ex  = merged[key]
                if (ex == null || q.savedAt > ex.savedAt) merged[key] = q
            }
            if (merged.isEmpty()) return@let
            db.quoteDao().deleteAll()
            for (q in merged.values) db.quoteDao().insert(q)
            // Push merged set back to cloud if local added new quotes
            if (merged.size > cloudQuotes.size) {
                val ws = merged.values.map { q -> WsQuote(q = q.text, a = q.author, ts = q.savedAt) }
                supabase.setFieldState("ls:savedQuotes",
                    json.encodeToString(ListSerializer(WsQuote.serializer()), ws))
            }
        }
    }

    // ── Focus Sessions ────────────────────────────────────────────────────────
    // Website key: "homer-sessions" → Supabase field_id: "ls:homer-sessions"
    // Format: [{ts, durationSecs, taskLabel}]

    @Serializable
    private data class WsSession(
        val ts: Long = 0L,
        val durationSecs: Int = 0,
        val taskLabel: String = "",
    )

    private suspend fun pushSessions() {
        val sessions = db.pomodoroDao().getRecentSessions().first()
        if (sessions.isEmpty()) return
        val ws = sessions.map { s -> WsSession(ts = s.ts, durationSecs = s.durationSecs, taskLabel = s.taskLabel) }
        supabase.setFieldState("ls:homer-sessions",
            json.encodeToString(ListSerializer(WsSession.serializer()), ws))
    }

    private suspend fun pullSessions() {
        supabase.getFieldState("ls:homer-sessions")?.let { row ->
            if (row.value.isBlank()) return@let
            val wsSessions = json.decodeFromString(ListSerializer(WsSession.serializer()), row.value)
            val existingTs = db.pomodoroDao().getAllSessionTs().toSet()
            val toInsert = wsSessions
                .filter { it.ts > 0 && it.ts !in existingTs && it.durationSecs > 0 }
                .map { PomodoroSession(ts = it.ts, durationSecs = it.durationSecs, taskLabel = it.taskLabel) }
            if (toInsert.isNotEmpty()) db.pomodoroDao().insertAllSessions(toInsert)
        }
    }

    // ── Pomodoro Settings ─────────────────────────────────────────────────────
    // Website key: "pom.settings.v1" → Supabase: "ls:pom-settings"
    // Stored as raw JSON blob in AppSetting table (key: "pom.settings.v1")

    private suspend fun pushPomSettings() {
        val v = db.appSettingDao().get("pom.settings.v1") ?: return
        if (v.isBlank()) return
        supabase.setFieldState("ls:pom-settings", v)
    }

    private suspend fun pullPomSettings() {
        supabase.getFieldState("ls:pom-settings")?.let { row ->
            if (row.value.isBlank()) return@let
            db.appSettingDao().set(AppSetting("pom.settings.v1", row.value))
        }
    }

    // ── Expense Templates ─────────────────────────────────────────────────────
    // Website key: "homer-expense-templates" → Supabase: "ls:homer-expense-templates"

    private suspend fun pushExpenseTemplates() {
        val v = db.appSettingDao().get("homer-expense-templates") ?: return
        if (v.isBlank()) return
        supabase.setFieldState("ls:homer-expense-templates", v)
    }

    private suspend fun pullExpenseTemplates() {
        supabase.getFieldState("ls:homer-expense-templates")?.let { row ->
            if (row.value.isBlank()) return@let
            db.appSettingDao().set(AppSetting("homer-expense-templates", row.value))
        }
    }

    // ── Expense Categories ────────────────────────────────────────────────────
    // Website key: "homer-expense-cats" → Supabase: "ls:homer-expense-cats"

    private suspend fun pushExpenseCats() {
        val v = db.appSettingDao().get("homer-expense-cats") ?: return
        if (v.isBlank()) return
        supabase.setFieldState("ls:homer-expense-cats", v)
    }

    private suspend fun pullExpenseCats() {
        supabase.getFieldState("ls:homer-expense-cats")?.let { row ->
            if (row.value.isBlank()) return@let
            db.appSettingDao().set(AppSetting("homer-expense-cats", row.value))
        }
    }

    // ── Payday Day ────────────────────────────────────────────────────────────
    // Website key: "homer-payday-day" → Supabase: "ls:homer-payday-day"

    private suspend fun pushPaydayDay() {
        val v = db.appSettingDao().get("homer-payday-day") ?: return
        if (v.isBlank()) return
        supabase.setFieldState("ls:homer-payday-day", v)
    }

    private suspend fun pullPaydayDay() {
        supabase.getFieldState("ls:homer-payday-day")?.let { row ->
            if (row.value.isBlank()) return@let
            db.appSettingDao().set(AppSetting("homer-payday-day", row.value))
        }
    }

    // ── Recurring Tasks ───────────────────────────────────────────────────────
    // Website key: "homer-recurring" → Supabase: "ls:homer-recurring"

    private suspend fun pushRecurring() {
        val v = db.appSettingDao().get("homer-recurring") ?: return
        if (v.isBlank()) return
        supabase.setFieldState("ls:homer-recurring", v)
    }

    private suspend fun pullRecurring() {
        supabase.getFieldState("ls:homer-recurring")?.let { row ->
            if (row.value.isBlank()) return@let
            db.appSettingDao().set(AppSetting("homer-recurring", row.value))
        }
    }

    // ── Weekly Reviews ────────────────────────────────────────────────────────
    // Website key: "homer-weekly-reviews" → Supabase: "ls:homer-weekly-reviews"

    private suspend fun pushWeeklyReviews() {
        val v = db.appSettingDao().get("homer-weekly-reviews") ?: return
        if (v.isBlank()) return
        supabase.setFieldState("ls:homer-weekly-reviews", v)
    }

    private suspend fun pullWeeklyReviews() {
        supabase.getFieldState("ls:homer-weekly-reviews")?.let { row ->
            if (row.value.isBlank()) return@let
            db.appSettingDao().set(AppSetting("homer-weekly-reviews", row.value))
        }
    }

    // ── Realtime field dispatcher ─────────────────────────────────────────────

    /**
     * Called by RealtimeSyncManager when a field_state row is updated by another device.
     * Routes the field_id to the correct pull method so Room is updated immediately.
     */
    suspend fun applyFieldUpdate(fieldId: String) {
        if (!supabase.isBogdan()) return
        // Cancel any pending local push for this field before applying the incoming remote update.
        // This prevents a stale debounced Android push from overwriting the fresh remote state
        // (which is the root cause of deletion resurrection bugs).
        val pushKey = when (fieldId) {
            "ls:homer-expenses", "ls:homer-income", "ls:homer-expense-budgets" -> "ls:homer-expenses"
            "ls:homer-habits"            -> "ls:homer-habits"
            "ls:homer-inbox"             -> "ls:homer-inbox"
            "ls:homer-links"             -> "ls:homer-links"
            "ls:pom-tasks"               -> "ls:pom-tasks"
            "ls:homer-notes"             -> "ls:homer-notes"
            "ls:homer-journal"           -> "ls:homer-journal"
            "ls:homer-car"               -> "ls:homer-car"
            "ls:homer-kanban"            -> "ls:homer-kanban"
            "ls:homer-life-goals"        -> "ls:homer-life-goals"
            "ls:homer-cal-events"        -> "ls:homer-cal-events"
            "ls:savedQuotes"             -> "ls:savedQuotes"
            "ls:homer-reminders"         -> "ls:homer-reminders"
            "ls:homer-secrets:personal",
            "ls:homer-secrets:work"      -> "ls:homer-secrets"
            "ls:homer-vault-notes:personal",
            "ls:homer-vault-notes:work"  -> "ls:homer-vault-notes"
            else -> null
        }
        pushKey?.let { cancelPendingPush(it) }
        runCatching {
            when (fieldId) {
                "ls:homer-expenses",
                "ls:homer-income",
                "ls:homer-expense-budgets"   -> pullExpenses()
                "ls:homer-habits"            -> pullHabits()
                "ls:homer-inbox"             -> pullInbox()
                "ls:homer-links"             -> pullLinks()
                "ls:pom-tasks"               -> pullPomodoroTasks()
                "ls:homer-notes"             -> pullNotes()
                "ls:homer-journal"           -> pullJournal()
                "ls:homer-car"               -> pullCar()
                "ls:homer-kanban"            -> pullKanban()
                "ls:homer-life-goals"        -> pullLifeGoals()
                "ls:homer-brain-dump"        -> pullBrainDump()
                "ls:homer-zen-goal"          -> pullZenGoal()
                "ls:homer-expense-goals"     -> pullExpenseGoals()
                "ls:homer-cal-events"        -> pullCalendarEvents()
                "ls:savedQuotes"             -> pullSavedQuotes()
                "ls:homer-sessions"          -> pullSessions()
                "ls:pom-settings"            -> pullPomSettings()
                "ls:homer-expense-templates" -> pullExpenseTemplates()
                "ls:homer-expense-cats"      -> pullExpenseCats()
                "ls:homer-payday-day"        -> pullPaydayDay()
                "ls:homer-recurring"         -> pullRecurring()
                "ls:homer-weekly-reviews"    -> pullWeeklyReviews()
                "ls:homer-countdown"         -> pullCountdown()
                "ls:homer-secrets:personal",
                "ls:homer-secrets:work"      -> pullSecrets()
                "ls:homer-vault-notes:personal",
                "ls:homer-vault-notes:work"  -> pullVaultNotes()
                "ls:homer-reminders"         -> pullReminders()
            }
        }.onFailure { Log.e("HomerSync", "applyFieldUpdate[$fieldId] failed", it) }
    }

    // ── Vault Secrets (Passwords) ─────────────────────────────────────────────
    // Website key: "homer-secrets:personal" / "homer-secrets:work"
    // Supabase field_id: "ls:homer-secrets:personal" / "ls:homer-secrets:work"
    // Website format: [{label, site, user, pass, details}]
    // Android: VaultCredential(id, label, site, username, passwordEncrypted, details)
    //   - "user" ↔ "username";  "pass" ↔ "passwordEncrypted"
    //   - No mode field on Android — personal+work credentials merged in one table

    @Serializable
    private data class WsVaultCred(
        val label: String = "",
        val site: String = "",
        val user: String = "",
        val pass: String = "",
        val details: String = "",
    )

    private suspend fun pushSecrets() {
        val creds = db.vaultDao().getAllCredentials()
        if (creds.isEmpty()) return
        val wsCreds = creds.map { c ->
            WsVaultCred(label = c.label, site = c.site, user = c.username,
                pass = c.passwordEncrypted, details = c.details)
        }
        val encoded = json.encodeToString(ListSerializer(WsVaultCred.serializer()), wsCreds)
        supabase.setFieldState("ls:homer-secrets:personal", encoded)
    }

    private suspend fun pullSecrets() {
        var replaced = false
        for (mode in listOf("personal", "work")) {
            supabase.getFieldState("ls:homer-secrets:$mode")?.let { row ->
                if (row.value.isBlank()) return@let
                val wsCreds = json.decodeFromString(ListSerializer(WsVaultCred.serializer()), row.value)
                if (wsCreds.isEmpty()) return@let
                if (!replaced) { db.vaultDao().clearAllCredentials(); replaced = true }
                wsCreds.forEach { c ->
                    db.vaultDao().upsertCredential(VaultCredential(
                        id = stableId(c.site, c.label),
                        label = c.label,
                        site = c.site,
                        username = c.user,
                        passwordEncrypted = c.pass,
                        details = c.details,
                    ))
                }
            }
        }
    }

    // ── Vault Notes ───────────────────────────────────────────────────────────
    // Website key: "homer-vault-notes:personal" / "homer-vault-notes:work"
    // Supabase field_id: "ls:homer-vault-notes:personal" / "ls:homer-vault-notes:work"
    // Website pushes JSON.stringify(vault.notes) → value is a JSON-encoded string
    // Android: VaultNote(id=1→personal, id=2→work, mode, textEncrypted)

    private suspend fun pushVaultNotes() {
        for (mode in listOf("personal", "work")) {
            val note = db.vaultDao().getNote(mode) ?: continue
            if (note.textEncrypted.isBlank()) continue
            supabase.setFieldState("ls:homer-vault-notes:$mode",
                json.encodeToString(note.textEncrypted))
        }
    }

    private suspend fun pullVaultNotes() {
        for (mode in listOf("personal", "work")) {
            supabase.getFieldState("ls:homer-vault-notes:$mode")?.let { row ->
                if (row.value.isBlank()) return@let
                val text = try { json.decodeFromString<String>(row.value) } catch (_: Exception) { row.value }
                if (text.isBlank()) return@let
                val id = if (mode == "work") 2 else 1
                db.vaultDao().upsertNote(VaultNote(id = id, mode = mode, textEncrypted = text))
            }
        }
    }

    // ── Countdown ─────────────────────────────────────────────────────────────
    // Website key: "homer-countdown" → Supabase: "ls:homer-countdown"
    // Format: {name: "", date: "YYYY-MM-DDTHH:mm", collapsed: false}
    // Android: SharedPreferences "homer_countdown" {name (String), dateMs (Long)}

    @Serializable
    private data class WsCountdown(
        val name: String = "",
        val date: String = "",      // ISO datetime-local e.g. "2026-12-31T23:59"
        val collapsed: Boolean = false,
    )

    private suspend fun pushCountdown() {
        val sp = ctx.getSharedPreferences("homer_countdown", Context.MODE_PRIVATE)
        val name   = sp.getString("name", "") ?: ""
        val dateMs = sp.getLong("dateMs", 0L)
        if (name.isBlank() && dateMs == 0L) return
        val date = if (dateMs > 0L) {
            val zdt = java.time.Instant.ofEpochMilli(dateMs)
                .atZone(java.time.ZoneId.systemDefault())
            "%04d-%02d-%02dT%02d:%02d".format(
                zdt.year, zdt.monthValue, zdt.dayOfMonth, zdt.hour, zdt.minute)
        } else ""
        supabase.setFieldState("ls:homer-countdown",
            json.encodeToString(WsCountdown.serializer(), WsCountdown(name = name, date = date)))
    }

    private suspend fun pullCountdown() {
        supabase.getFieldState("ls:homer-countdown")?.let { row ->
            if (row.value.isBlank()) return@let
            val ws = json.decodeFromString(WsCountdown.serializer(), row.value)
            if (ws.name.isBlank() && ws.date.isBlank()) return@let
            val dateMs = if (ws.date.isNotBlank()) {
                try {
                    val str = if (ws.date.length == 16) "${ws.date}:00" else ws.date
                    java.time.LocalDateTime.parse(str)
                        .atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
                } catch (_: Exception) {
                    try {
                        java.time.LocalDate.parse(ws.date)
                            .atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
                    } catch (_: Exception) { 0L }
                }
            } else 0L
            ctx.getSharedPreferences("homer_countdown", Context.MODE_PRIVATE).edit()
                .putString("name", ws.name)
                .putLong("dateMs", dateMs)
                .apply()
        }
    }

    // ── Reminders ─────────────────────────────────────────────────────────────
    // Website key: "homer-reminders" → Supabase field_id: "ls:homer-reminders"
    // Format: [{id, title, body, triggerAt, recurType, enabled, createdAt}]
    // Matches Android Reminder entity exactly.

    private suspend fun pushReminders() {
        val reminders = db.reminderDao().getAllSync()
        if (reminders.isEmpty()) return
        supabase.setFieldState("ls:homer-reminders",
            json.encodeToString(ListSerializer(Reminder.serializer()), reminders))
    }

    private suspend fun pullReminders() {
        supabase.getFieldState("ls:homer-reminders")?.let { row ->
            if (row.value.isBlank()) return@let
            val cloudReminders = json.decodeFromString(ListSerializer(Reminder.serializer()), row.value)
            if (cloudReminders.isEmpty()) return@let
            db.reminderDao().clearAll()
            db.reminderDao().upsertAll(cloudReminders)
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Stable, reproducible ID derived from url + name (for links pulled from website). */
    private fun stableId(url: String, name: String): String =
        (url.trimEnd('/') + "|" + name).hashCode().toLong()
            .let { if (it < 0) it + Long.MAX_VALUE else it }
            .toString()

}
