package ro.b4it.homer.data.sync

import android.content.Context
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.*
import ro.b4it.homer.data.local.HomerDatabase
import ro.b4it.homer.data.local.entity.*
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * SyncEngine — bidirectional sync between Room (local) and the CF Pages /api/sync endpoint.
 *
 * Rules:
 *  - Not configured (no admin hash): all methods are no-ops; data lives only in Room.
 *  - Configured: on app launch pull all fields once → store in Room; on user write debounce 8s → push.
 *
 * Field IDs and JSON formats MUST match the website's localStorage / field_state schema.
 */
@Singleton
class SyncEngine @Inject constructor(
    @ApplicationContext private val ctx: Context,
    private val db: HomerDatabase,
    private val syncClient: SyncClient,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val pendingJobs = mutableMapOf<String, Job>()
    private val DEBOUNCE_MS = 8_000L

    /**
     * Mutex that ensures only one pullAll() runs at a time.
     * tryLock() returns false if a pull is already in-flight; callers skip silently.
     * This prevents concurrent Supabase reads + racing Room writes from startup,
     * SyncWorker, HomeViewModel.pullAll(), and SyncViewModel.startPull().
     */
    private val pullMutex = Mutex()

    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    /** Cache populated once per pullAll() call — avoids N individual HTTP calls. */
    @Volatile private var fieldCache: Map<String, String> = emptyMap()

    /**
     * Timestamp of the last successful pullAll() completion.
     * Used by onForeground() to skip redundant pulls when the app is re-opened
     * within a short window.
     */
    @Volatile private var lastPullAt = 0L
    private val FOREGROUND_PULL_INTERVAL_MS = 2 * 60_000L   // 2 minutes

    /** Returns the cached value for [fieldId], or null if missing/blank. */
    private fun fieldValue(fieldId: String): String? =
        fieldCache[fieldId]?.takeIf { it.isNotBlank() }

    /**
     * On first launch with sync configured, push local Room data to cloud BEFORE pulling.
     * This prevents the "pull wipes local-only data" problem when the user installs the app
     * with data already in Room that was created before sync was set up.
     * On subsequent launches, just pull (pushes happen via debounced writes).
     */
    fun start() {
        if (!syncClient.isConfigured()) return
        scope.launch {
            val prefs = ctx.getSharedPreferences("homer_sync", Context.MODE_PRIVATE)
            val bootstrapped = prefs.getBoolean("sync_bootstrapped", false)
            if (!bootstrapped) {
                Log.d("HomerSync", "start: first sync — pushing local data first to preserve it")
                runCatching { pushAll() }
                    .onFailure { Log.e("HomerSync", "start: initial pushAll failed", it) }
                prefs.edit().putBoolean("sync_bootstrapped", true).apply()
            }
            runCatching { pullAll() }
                .onFailure { Log.e("HomerSync", "start: pullAll failed", it) }
        }
    }

    /** Fetch all fields from the cloud in one call, then update Room for each enabled field. */
    suspend fun pullAll() {
        if (!syncClient.isConfigured()) return
        // Deduplicate: if a pull is already in flight, skip this call to prevent
        // concurrent Supabase reads and racing Room clear+upsert operations.
        if (!pullMutex.tryLock()) {
            Log.d("HomerSync", "pullAll: already in flight, skipping duplicate call")
            return
        }
        try {
        fieldCache = syncClient.getAllFields()
        Log.d("HomerSync", "pullAll: fetched ${fieldCache.size} fields")
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
        lastPullAt = System.currentTimeMillis()
        Log.d("HomerSync", "pullAll: done")
        } finally {
            pullMutex.unlock()
        }
    }

    /**
     * Called when the app comes to the foreground (activity resumed).
     * Pulls fresh data if it has been longer than [FOREGROUND_PULL_INTERVAL_MS] since the last pull.
     * This ensures website changes appear promptly when the user opens the app, without
     * hammering the server on every config change or screen rotation.
     */
    fun onForeground() {
        if (!syncClient.isConfigured()) return
        val now = System.currentTimeMillis()
        if (now - lastPullAt < FOREGROUND_PULL_INTERVAL_MS) return
        scope.launch {
            runCatching { pullAll() }
                .onFailure { Log.e("HomerSync", "onForeground: pullAll failed", it) }
        }
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
                runCatching { push() }
                    .onFailure { Log.e("HomerSync", "schedulePush[$fieldKey] failed", it) }
            }
        }
    }

    fun pushExpensesDebounced()         = schedulePush("ls:homer-expenses")            { pushExpenses() }
    fun pushHabitsDebounced()           = schedulePush("ls:homer-habits")              { pushHabits() }
    fun pushInboxDebounced()            = schedulePush("ls:homer-inbox")               { pushInbox() }
    fun pushLinksDebounced()            = schedulePush("ls:homer-links")               { pushLinks() }
    fun pushPomodoroTasksDebounced()    = schedulePush("ls:pom-tasks")                 { pushPomodoroTasks() }
    fun pushNotesDebounced()            = schedulePush("ls:homer-notes")               { pushNotes() }
    fun pushJournalDebounced()          = schedulePush("ls:homer-journal")             { pushJournal() }
    fun pushCarDebounced()              = schedulePush("ls:homer-car")                 { pushCar() }
    fun pushKanbanDebounced()           = schedulePush("ls:homer-kanban")              { pushKanban() }
    fun pushLifeGoalsDebounced()        = schedulePush("ls:homer-life-goals")          { pushLifeGoals() }
    fun pushBrainDumpDebounced()        = schedulePush("ls:homer-brain-dump")          { pushBrainDump() }
    fun pushZenGoalDebounced()          = schedulePush("ls:homer-zen-goal")            { pushZenGoal() }
    fun pushExpenseGoalsDebounced()     = schedulePush("ls:homer-expense-goals")       { pushExpenseGoals() }
    fun pushCalendarEventsDebounced()   = schedulePush("ls:homer-cal-events")          { pushCalendarEvents() }
    fun pushSavedQuotesDebounced()      = schedulePush("ls:savedQuotes")               { pushSavedQuotes() }
    fun pushSessionsDebounced()         = schedulePush("ls:homer-sessions")            { pushSessions() }
    fun pushPomSettingsDebounced()      = schedulePush("ls:pom-settings")              { pushPomSettings() }
    fun pushExpenseTemplatesDebounced() = schedulePush("ls:homer-expense-templates")   { pushExpenseTemplates() }
    fun pushExpenseCatsDebounced()      = schedulePush("ls:homer-expense-cats")        { pushExpenseCats() }
    fun pushPaydayDayDebounced()        = schedulePush("ls:homer-payday-day")          { pushPaydayDay() }
    fun pushRecurringDebounced()        = schedulePush("ls:homer-recurring")           { pushRecurring() }
    fun pushWeeklyReviewsDebounced()    = schedulePush("ls:homer-weekly-reviews")      { pushWeeklyReviews() }
    fun pushCountdownDebounced()        = schedulePush("ls:homer-countdown")           { pushCountdown() }
    fun pushSecretsDebounced()          = schedulePush("ls:homer-secrets")             { pushSecrets() }
    fun pushVaultNotesDebounced()       = schedulePush("ls:homer-vault-notes")         { pushVaultNotes() }
    fun pushRemindersDebounced()        = schedulePush("ls:homer-reminders")           { pushReminders() }

    /** Push Pomodoro tasks immediately — called on delete to prevent next pull restoring deleted items. */
    suspend fun pushPomodoroTasksNow() {
        if (!syncClient.isConfigured()) return
        runCatching { pushPomodoroTasks() }
    }

    /** Push vault secrets immediately — called on add/delete to prevent next pull restoring deleted items. */
    suspend fun pushSecretsNow() {
        if (!syncClient.isConfigured()) return
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
        syncClient.pushField("ls:homer-expenses",
            json.encodeToString(ListSerializer(WsExpense.serializer()), wsExp))
        // Income (type="income") → ls:homer-income
        val wsInc = all.filter { it.type == "income" }.map { it.toWsExpense() }
        if (wsInc.isNotEmpty())
            syncClient.pushField("ls:homer-income",
                json.encodeToString(ListSerializer(WsExpense.serializer()), wsInc))
        // Budgets → {category: limit} object (website format)
        val budgets = db.expenseDao().getAllBudgets().first()
        if (budgets.isNotEmpty()) {
            val budgetObj = buildJsonObject { budgets.forEach { b -> put(b.category, b.limit) } }
            syncClient.pushField("ls:homer-expense-budgets", budgetObj.toString())
        }
    }

    private suspend fun pullExpenses() {
        // Cloud wins: fetch both expense + income arrays, then replace local entirely.
        val cloudExp = fieldValue("ls:homer-expenses")?.let { v ->
            json.decodeFromString(ListSerializer(WsExpense.serializer()), v)
                .map { it.toExpense("expense") }
        }
        val cloudInc = fieldValue("ls:homer-income")?.let { v ->
            json.decodeFromString(ListSerializer(WsExpense.serializer()), v)
                .map { it.toExpense("income") }
        }
        if (!cloudExp.isNullOrEmpty() || !cloudInc.isNullOrEmpty()) {
            db.expenseDao().clearAll()
            cloudExp?.let { if (it.isNotEmpty()) db.expenseDao().upsertAll(it) }
            cloudInc?.let { if (it.isNotEmpty()) db.expenseDao().upsertAll(it) }
        }
        // Pull budgets — website stores as {category: limit} object
        fieldValue("ls:homer-expense-budgets")?.let { v ->
            val elem = try { json.parseToJsonElement(v) } catch (_: Exception) { return@let }
            val budgets: List<Budget> = when (elem) {
                is JsonObject -> elem.entries.mapNotNull { (cat, bv) ->
                    val limit = (bv as? JsonPrimitive)?.doubleOrNull ?: return@mapNotNull null
                    Budget(category = cat, limit = limit)
                }
                is JsonArray  -> runCatching {
                    json.decodeFromString(ListSerializer(Budget.serializer()), v)
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
        syncClient.pushField("ls:homer-habits",
            json.encodeToString(WsHabitsBlob.serializer(), blob))
    }

    private suspend fun pullHabits() {
        val fieldVal = fieldValue("ls:homer-habits") ?: return
        val blob = json.decodeFromString(WsHabitsBlob.serializer(), fieldVal)
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
        if (habits.isEmpty()) return  // safety: don't wipe local with empty cloud
        val knownIds = habits.map { it.clientId }.toSet()
        val completions = blob.completions.mapNotNull { (key, elem) ->
            val colon = key.lastIndexOf(':')
            if (colon < 1) return@mapNotNull null
            val habitId = key.substring(0, colon)
            val date    = key.substring(colon + 1)
            if (habitId !in knownIds) return@mapNotNull null
            val count = when (elem) {
                is JsonPrimitive -> elem.intOrNull ?: if (elem.booleanOrNull == true) 1 else 0
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

    // ── Inbox ─────────────────────────────────────────────────────────────────
    // Website format: [{id, text, type, createdAt}] — matches Android InboxItem exactly.

    private suspend fun pushInbox() {
        val items = db.inboxDao().getAll().first()
        syncClient.pushField("ls:homer-inbox",
            json.encodeToString(ListSerializer(InboxItem.serializer()), items))
    }

    private suspend fun pullInbox() {
        val v = fieldValue("ls:homer-inbox") ?: return
        val items = json.decodeFromString(ListSerializer(InboxItem.serializer()), v)
        if (items.isEmpty()) return
        db.inboxDao().clearAll()
        db.inboxDao().upsertAll(items)
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
        syncClient.pushField("ls:homer-links",
            json.encodeToString(ListSerializer(WsLink.serializer()), wsLinks))
    }

    private suspend fun pullLinks() {
        val v = fieldValue("ls:homer-links") ?: return
        val wsLinks = json.decodeFromString(ListSerializer(WsLink.serializer()), v)
        if (wsLinks.isEmpty()) return
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
        syncClient.pushField("ls:pom-tasks",
            json.encodeToString(ListSerializer(WsTask.serializer()), wsTasks))
    }

    private suspend fun pullPomodoroTasks() {
        val v = fieldValue("ls:pom-tasks") ?: return
        val wsTasks = json.decodeFromString(ListSerializer(WsTask.serializer()), v)
        if (wsTasks.isEmpty()) return
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
        syncClient.pushField("ls:homer-notes",
            json.encodeToString(ListSerializer(Note.serializer()), notes))
    }

    private suspend fun pullNotes() {
        val v = fieldValue("ls:homer-notes") ?: return
        val wsNotes = json.decodeFromString(ListSerializer(WsNote.serializer()), v)
        val cloudNotes = wsNotes.filter { it.id.isNotBlank() }.map { it.toNote() }
        if (cloudNotes.isEmpty()) return
        db.noteDao().clearAll()
        db.noteDao().upsertAll(cloudNotes)
    }

    // ── Journal ───────────────────────────────────────────────────────────────
    // Website key: "homer-journal" → Supabase field_id: "ls:homer-journal"
    // Format: [{id, date, content, mood, moodLabel, aiReflection, wordCount, createdAt, updatedAt}]

    private suspend fun pushJournal() {
        val entries = db.journalDao().getAll().first()
        if (entries.isEmpty()) return
        syncClient.pushField("ls:homer-journal",
            json.encodeToString(ListSerializer(JournalEntry.serializer()), entries))
    }

    private suspend fun pullJournal() {
        val v = fieldValue("ls:homer-journal") ?: return
        val cloudEntries = json.decodeFromString(ListSerializer(JournalEntry.serializer()), v)
        if (cloudEntries.isEmpty()) return
        db.journalDao().clearAll()
        db.journalDao().upsertAll(cloudEntries)
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
        syncClient.pushField("ls:homer-car", json.encodeToString(CarBlob.serializer(), blob))
    }

    private suspend fun pullCar() {
        val v = fieldValue("ls:homer-car") ?: return
        val blob = json.decodeFromString(CarBlob.serializer(), v)
        if (blob.vehicles.isEmpty() && blob.documents.isEmpty() &&
            blob.maintenance.isEmpty() && blob.fuel.isEmpty()) return
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
        syncClient.pushField("ls:homer-kanban", json.encodeToString(KanbanBlobWs.serializer(), blob))
    }

    private suspend fun pullKanban() {
        val v = fieldValue("ls:homer-kanban") ?: return
        val blob     = json.decodeFromString(KanbanBlobWs.serializer(), v)
        // Union tasks + goals, then deduplicate by id (prevents duplication if both keys exist)
        val allTasks = (blob.tasks + blob.goals).distinctBy { jsonElemStr(it.id) }
        val projects = blob.projects.map { it.toProject() }
        val tasks    = allTasks.map { it.toTask() }
        if (projects.isEmpty() && tasks.isEmpty()) return
        // Cloud wins: clear all, upsert cloud
        db.kanbanDao().clearAllProjects()
        db.kanbanDao().clearAllTasks()
        if (projects.isNotEmpty()) db.kanbanDao().upsertProjects(projects)
        if (tasks.isNotEmpty())    db.kanbanDao().upsertTasks(tasks)
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
        syncClient.pushField("ls:homer-life-goals",
            json.encodeToString(ListSerializer(WsLifeGoal.serializer()), wsGoals))
    }

    private suspend fun pullLifeGoals() {
        val v = fieldValue("ls:homer-life-goals") ?: return
        val wsGoals = json.decodeFromString(ListSerializer(WsLifeGoal.serializer()), v)
        val goals   = wsGoals.map { it.toLifeGoal() }
        if (goals.isEmpty()) return
        db.lifeGoalDao().clearAll()
        db.lifeGoalDao().upsertAll(goals)
    }

    // ── Focus Lab — brain dump & zen goal ─────────────────────────────────────
    // Stored as plain text strings in AppSetting table.
    // Web keys: "homer-brain-dump" → "ls:homer-brain-dump", "homer-zen-goal" → "ls:homer-zen-goal"

    private suspend fun pushBrainDump() {
        val text = db.appSettingDao().get("homer-brain-dump") ?: return
        syncClient.pushField("ls:homer-brain-dump", text)
    }

    private suspend fun pullBrainDump() {
        val v = fieldValue("ls:homer-brain-dump") ?: return
        db.appSettingDao().set(AppSetting("homer-brain-dump", v))
    }

    private suspend fun pushZenGoal() {
        val text = db.appSettingDao().get("homer-zen-goal") ?: return
        syncClient.pushField("ls:homer-zen-goal", text)
    }

    private suspend fun pullZenGoal() {
        val v = fieldValue("ls:homer-zen-goal") ?: return
        db.appSettingDao().set(AppSetting("homer-zen-goal", v))
    }

    // ── Expense Goals ─────────────────────────────────────────────────────────
    // Website key: "homer-expense-goals" → [{id: number, name, target, saved, color}]
    // Android: stored as AppSetting JSON blob (no dedicated entity needed)

    private suspend fun pushExpenseGoals() {
        val text = db.appSettingDao().get("homer-expense-goals") ?: return
        if (text.isBlank()) return
        syncClient.pushField("ls:homer-expense-goals", text)
    }

    private suspend fun pullExpenseGoals() {
        val v = fieldValue("ls:homer-expense-goals") ?: return
        db.appSettingDao().set(AppSetting("homer-expense-goals", v))
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
        syncClient.pushField("ls:homer-cal-events",
            json.encodeToString(ListSerializer(WsCalEvent.serializer()), wsEvents))
    }

    private suspend fun pullCalendarEvents() {
        val v = fieldValue("ls:homer-cal-events") ?: return
        val wsEvents = json.decodeFromString(ListSerializer(WsCalEvent.serializer()), v)
        val cloudEvents = wsEvents.filter { it.id.isNotBlank() && it.date.isNotBlank() }
            .map { it.toCalendarEvent() }
        if (cloudEvents.isEmpty()) return
        db.calendarDao().clearManualEvents()
        db.calendarDao().upsertAll(cloudEvents)
    }

    // ── Push all ─────────────────────────────────────────────────────────────

    /** Push all enabled fields to the cloud. Called from SyncViewModel "Push to Cloud". */
    suspend fun pushAll() {
        if (!syncClient.isConfigured()) return
        if (isFieldEnabled("ls:homer-expenses"))            runCatching { pushExpenses()         }.onFailure { Log.e("HomerSync", "pushExpenses failed", it) }
        if (isFieldEnabled("ls:homer-habits"))              runCatching { pushHabits()           }.onFailure { Log.e("HomerSync", "pushHabits failed", it) }
        if (isFieldEnabled("ls:homer-inbox"))               runCatching { pushInbox()            }.onFailure { Log.e("HomerSync", "pushInbox failed", it) }
        if (isFieldEnabled("ls:homer-links"))               runCatching { pushLinks()            }.onFailure { Log.e("HomerSync", "pushLinks failed", it) }
        if (isFieldEnabled("ls:pom-tasks"))                 runCatching { pushPomodoroTasks()    }.onFailure { Log.e("HomerSync", "pushTasks failed", it) }
        if (isFieldEnabled("ls:homer-notes"))               runCatching { pushNotes()            }.onFailure { Log.e("HomerSync", "pushNotes failed", it) }
        if (isFieldEnabled("ls:homer-journal"))             runCatching { pushJournal()          }.onFailure { Log.e("HomerSync", "pushJournal failed", it) }
        if (isFieldEnabled("ls:homer-car"))                 runCatching { pushCar()              }.onFailure { Log.e("HomerSync", "pushCar failed", it) }
        if (isFieldEnabled("ls:homer-kanban"))              runCatching { pushKanban()           }.onFailure { Log.e("HomerSync", "pushKanban failed", it) }
        if (isFieldEnabled("ls:homer-life-goals"))          runCatching { pushLifeGoals()        }.onFailure { Log.e("HomerSync", "pushLifeGoals failed", it) }
        if (isFieldEnabled("ls:homer-brain-dump"))          runCatching { pushBrainDump()        }.onFailure { Log.e("HomerSync", "pushBrainDump failed", it) }
        if (isFieldEnabled("ls:homer-zen-goal"))            runCatching { pushZenGoal()          }.onFailure { Log.e("HomerSync", "pushZenGoal failed", it) }
        if (isFieldEnabled("ls:homer-expense-goals"))       runCatching { pushExpenseGoals()     }.onFailure { Log.e("HomerSync", "pushExpenseGoals failed", it) }
        if (isFieldEnabled("ls:homer-cal-events"))          runCatching { pushCalendarEvents()   }.onFailure { Log.e("HomerSync", "pushCalendarEvents failed", it) }
        if (isFieldEnabled("ls:savedQuotes"))               runCatching { pushSavedQuotes()      }.onFailure { Log.e("HomerSync", "pushSavedQuotes failed", it) }
        if (isFieldEnabled("ls:homer-sessions"))            runCatching { pushSessions()         }.onFailure { Log.e("HomerSync", "pushSessions failed", it) }
        if (isFieldEnabled("ls:pom-settings"))              runCatching { pushPomSettings()      }.onFailure { Log.e("HomerSync", "pushPomSettings failed", it) }
        if (isFieldEnabled("ls:homer-expense-templates"))   runCatching { pushExpenseTemplates() }.onFailure { Log.e("HomerSync", "pushExpenseTemplates failed", it) }
        if (isFieldEnabled("ls:homer-expense-cats"))        runCatching { pushExpenseCats()      }.onFailure { Log.e("HomerSync", "pushExpenseCats failed", it) }
        if (isFieldEnabled("ls:homer-payday-day"))          runCatching { pushPaydayDay()        }.onFailure { Log.e("HomerSync", "pushPaydayDay failed", it) }
        if (isFieldEnabled("ls:homer-recurring"))           runCatching { pushRecurring()        }.onFailure { Log.e("HomerSync", "pushRecurring failed", it) }
        if (isFieldEnabled("ls:homer-weekly-reviews"))      runCatching { pushWeeklyReviews()    }.onFailure { Log.e("HomerSync", "pushWeeklyReviews failed", it) }
        if (isFieldEnabled("ls:homer-countdown"))           runCatching { pushCountdown()        }.onFailure { Log.e("HomerSync", "pushCountdown failed", it) }
        if (isFieldEnabled("ls:homer-secrets"))             runCatching { pushSecrets()          }.onFailure { Log.e("HomerSync", "pushSecrets failed", it) }
        if (isFieldEnabled("ls:homer-vault-notes"))         runCatching { pushVaultNotes()       }.onFailure { Log.e("HomerSync", "pushVaultNotes failed", it) }
        if (isFieldEnabled("ls:homer-reminders"))           runCatching { pushReminders()        }.onFailure { Log.e("HomerSync", "pushReminders failed", it) }
        Log.d("HomerSync", "pushAll: done")
    }

    // ── Removed: detectConflicts / pullWithResolutions / applyFieldUpdate (Option A) ─
    // These methods used Supabase SDK directly. Replaced by pullAll() + pushAll() via SyncClient.


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
        syncClient.pushField("ls:savedQuotes",
            json.encodeToString(ListSerializer(WsQuote.serializer()), ws))
    }

    private suspend fun pullSavedQuotes() {
        val v = fieldValue("ls:savedQuotes") ?: return
        val wsQuotes = json.decodeFromString(ListSerializer(WsQuote.serializer()), v)
        val cloudQuotes = wsQuotes.map { it.toSavedQuote() }.filter { it.text.isNotBlank() }
        if (cloudQuotes.isEmpty()) return
        // Merge: union of local + cloud, dedup by lowercased text, keep most recent
        val localQuotes = db.quoteDao().getAll().first()
        val merged = mutableMapOf<String, SavedQuote>()
        for (q in cloudQuotes) merged[q.text.trim().lowercase()] = q
        for (q in localQuotes) {
            val key = q.text.trim().lowercase()
            val ex  = merged[key]
            if (ex == null || q.savedAt > ex.savedAt) merged[key] = q
        }
        if (merged.isEmpty()) return
        db.quoteDao().deleteAll()
        for (q in merged.values) db.quoteDao().insert(q)
        // Push merged set back to cloud if local added new quotes
        if (merged.size > cloudQuotes.size) {
            val ws = merged.values.map { q -> WsQuote(q = q.text, a = q.author, ts = q.savedAt) }
            syncClient.pushField("ls:savedQuotes",
                json.encodeToString(ListSerializer(WsQuote.serializer()), ws))
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
        syncClient.pushField("ls:homer-sessions",
            json.encodeToString(ListSerializer(WsSession.serializer()), ws))
    }

    private suspend fun pullSessions() {
        val v = fieldValue("ls:homer-sessions") ?: return
        val wsSessions = json.decodeFromString(ListSerializer(WsSession.serializer()), v)
        val existingTs = db.pomodoroDao().getAllSessionTs().toSet()
        val toInsert = wsSessions
            .filter { it.ts > 0 && it.ts !in existingTs && it.durationSecs > 0 }
            .map { PomodoroSession(ts = it.ts, durationSecs = it.durationSecs, taskLabel = it.taskLabel) }
        if (toInsert.isNotEmpty()) db.pomodoroDao().insertAllSessions(toInsert)
    }

    // ── Pomodoro Settings ─────────────────────────────────────────────────────
    // Website key: "pom.settings.v1" → Supabase: "ls:pom-settings"
    // Stored as raw JSON blob in AppSetting table (key: "pom.settings.v1")

    private suspend fun pushPomSettings() {
        val v = db.appSettingDao().get("pom.settings.v1") ?: return
        if (v.isBlank()) return
        syncClient.pushField("ls:pom-settings", v)
    }

    private suspend fun pullPomSettings() {
        val v = fieldValue("ls:pom-settings") ?: return
        db.appSettingDao().set(AppSetting("pom.settings.v1", v))
    }

    // ── Expense Templates ─────────────────────────────────────────────────────
    // Website key: "homer-expense-templates" → Supabase: "ls:homer-expense-templates"

    private suspend fun pushExpenseTemplates() {
        val v = db.appSettingDao().get("homer-expense-templates") ?: return
        if (v.isBlank()) return
        syncClient.pushField("ls:homer-expense-templates", v)
    }

    private suspend fun pullExpenseTemplates() {
        val v = fieldValue("ls:homer-expense-templates") ?: return
        db.appSettingDao().set(AppSetting("homer-expense-templates", v))
    }

    // ── Expense Categories ────────────────────────────────────────────────────
    // Website key: "homer-expense-cats" → Supabase: "ls:homer-expense-cats"

    private suspend fun pushExpenseCats() {
        val v = db.appSettingDao().get("homer-expense-cats") ?: return
        if (v.isBlank()) return
        syncClient.pushField("ls:homer-expense-cats", v)
    }

    private suspend fun pullExpenseCats() {
        val v = fieldValue("ls:homer-expense-cats") ?: return
        db.appSettingDao().set(AppSetting("homer-expense-cats", v))
    }

    // ── Payday Day ────────────────────────────────────────────────────────────
    // Website key: "homer-payday-day" → Supabase: "ls:homer-payday-day"

    private suspend fun pushPaydayDay() {
        val v = db.appSettingDao().get("homer-payday-day") ?: return
        if (v.isBlank()) return
        syncClient.pushField("ls:homer-payday-day", v)
    }

    private suspend fun pullPaydayDay() {
        val v = fieldValue("ls:homer-payday-day") ?: return
        db.appSettingDao().set(AppSetting("homer-payday-day", v))
    }

    // ── Recurring Tasks ───────────────────────────────────────────────────────
    // Website key: "homer-recurring" → Supabase: "ls:homer-recurring"

    private suspend fun pushRecurring() {
        val v = db.appSettingDao().get("homer-recurring") ?: return
        if (v.isBlank()) return
        syncClient.pushField("ls:homer-recurring", v)
    }

    private suspend fun pullRecurring() {
        val v = fieldValue("ls:homer-recurring") ?: return
        db.appSettingDao().set(AppSetting("homer-recurring", v))
    }

    // ── Weekly Reviews ────────────────────────────────────────────────────────
    // Website key: "homer-weekly-reviews" → Supabase: "ls:homer-weekly-reviews"

    private suspend fun pushWeeklyReviews() {
        val v = db.appSettingDao().get("homer-weekly-reviews") ?: return
        if (v.isBlank()) return
        syncClient.pushField("ls:homer-weekly-reviews", v)
    }

    private suspend fun pullWeeklyReviews() {
        val v = fieldValue("ls:homer-weekly-reviews") ?: return
        db.appSettingDao().set(AppSetting("homer-weekly-reviews", v))
    }

    // ── Note: Realtime subscription removed ──────────────────────────────────
    // RealtimeSyncManager was removed in favour of a simpler pull-only model:
    //  - on startup  → start() → pullAll()
    //  - on foreground (Activity.onResume, 2-min debounce) → onForeground() → pullAll()
    //  - on network reconnect (one-shot ConnectivityManager callback) → pullAll()
    //  - background (SyncWorker every 15 min) → pullAll()
    // Website changes therefore appear on Android within 2 min of opening the app.

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
        syncClient.pushField("ls:homer-secrets:personal", encoded)
    }

    private suspend fun pullSecrets() {
        var replaced = false
        for (mode in listOf("personal", "work")) {
            val v = fieldValue("ls:homer-secrets:$mode") ?: continue
            val wsCreds = json.decodeFromString(ListSerializer(WsVaultCred.serializer()), v)
            if (wsCreds.isEmpty()) continue
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

    // ── Vault Notes ───────────────────────────────────────────────────────────
    // Website key: "homer-vault-notes:personal" / "homer-vault-notes:work"
    // Supabase field_id: "ls:homer-vault-notes:personal" / "ls:homer-vault-notes:work"
    // Website pushes JSON.stringify(vault.notes) → value is a JSON-encoded string
    // Android: VaultNote(id=1→personal, id=2→work, mode, textEncrypted)

    private suspend fun pushVaultNotes() {
        for (mode in listOf("personal", "work")) {
            val note = db.vaultDao().getNote(mode) ?: continue
            if (note.textEncrypted.isBlank()) continue
            syncClient.pushField("ls:homer-vault-notes:$mode",
                json.encodeToString(String.serializer(), note.textEncrypted))
        }
    }

    private suspend fun pullVaultNotes() {
        for (mode in listOf("personal", "work")) {
            val v = fieldValue("ls:homer-vault-notes:$mode") ?: continue
            val text = try { json.decodeFromString<String>(v) } catch (_: Exception) { v }
            if (text.isBlank()) continue
            val id = if (mode == "work") 2 else 1
            db.vaultDao().upsertNote(VaultNote(id = id, mode = mode, textEncrypted = text))
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
        syncClient.pushField("ls:homer-countdown",
            json.encodeToString(WsCountdown.serializer(), WsCountdown(name = name, date = date)))
    }

    private suspend fun pullCountdown() {
        val v = fieldValue("ls:homer-countdown") ?: return
        val ws = json.decodeFromString(WsCountdown.serializer(), v)
        if (ws.name.isBlank() && ws.date.isBlank()) return
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

    // ── Reminders ─────────────────────────────────────────────────────────────
    // Website key: "homer-reminders" → Supabase field_id: "ls:homer-reminders"
    // Format: [{id, title, body, triggerAt, recurType, enabled, createdAt}]
    // Matches Android Reminder entity exactly.

    private suspend fun pushReminders() {
        val reminders = db.reminderDao().getAllSync()
        if (reminders.isEmpty()) return
        syncClient.pushField("ls:homer-reminders",
            json.encodeToString(ListSerializer(Reminder.serializer()), reminders))
    }

    private suspend fun pullReminders() {
        val v = fieldValue("ls:homer-reminders") ?: return
        val cloudReminders = json.decodeFromString(ListSerializer(Reminder.serializer()), v)
        if (cloudReminders.isEmpty()) return
        db.reminderDao().clearAll()
        db.reminderDao().upsertAll(cloudReminders)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Stable, reproducible ID derived from url + name (for links pulled from website). */
    private fun stableId(url: String, name: String): String =
        (url.trimEnd('/') + "|" + name).hashCode().toLong()
            .let { if (it < 0) it + Long.MAX_VALUE else it }
            .toString()

}
