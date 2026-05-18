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

    /** Called on app launch after auth is determined. */
    fun start() {
        if (!supabase.isBogdan()) return
        scope.launch { pullAll() }
    }

    /** Pull all synced fields from Supabase and merge into Room. Throws on auth failure. */
    suspend fun pullAll() {
        supabase.ensureSignedIn()
        Log.d("HomerSync", "pullAll: userId=${supabase.userId} isBogdan=${supabase.isBogdan()}")
        if (!supabase.isBogdan()) { Log.w("HomerSync", "pullAll: not Bogdan, aborting"); return }
        runCatching { pullExpenses()     }.onFailure { Log.e("HomerSync", "pullExpenses failed", it) }
        runCatching { pullHabits()       }.onFailure { Log.e("HomerSync", "pullHabits failed", it) }
        runCatching { pullInbox()        }.onFailure { Log.e("HomerSync", "pullInbox failed", it) }
        runCatching { pullLinks()        }.onFailure { Log.e("HomerSync", "pullLinks failed", it) }
        runCatching { pullPomodoroTasks()}.onFailure { Log.e("HomerSync", "pullTasks failed", it) }
        runCatching { pullNotes()        }.onFailure { Log.e("HomerSync", "pullNotes failed", it) }
        runCatching { pullJournal()      }.onFailure { Log.e("HomerSync", "pullJournal failed", it) }
        runCatching { pullCar()          }.onFailure { Log.e("HomerSync", "pullCar failed", it) }
        runCatching { pullKanban()       }.onFailure { Log.e("HomerSync", "pullKanban failed", it) }
        runCatching { pullLifeGoals()    }.onFailure { Log.e("HomerSync", "pullLifeGoals failed", it) }
        Log.d("HomerSync", "pullAll: done")
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

    fun pushExpensesDebounced()      = schedulePush("ls:homer-expenses")   { pushExpenses() }
    fun pushHabitsDebounced()        = schedulePush("ls:homer-habits")     { pushHabits() }
    fun pushInboxDebounced()         = schedulePush("ls:homer-inbox")      { pushInbox() }
    fun pushLinksDebounced()         = schedulePush("ls:homer-links")      { pushLinks() }
    fun pushPomodoroTasksDebounced() = schedulePush("ls:pom-tasks")        { pushPomodoroTasks() }
    fun pushNotesDebounced()         = schedulePush("ls:homer-notes")      { pushNotes() }
    fun pushJournalDebounced()       = schedulePush("ls:homer-journal")    { pushJournal() }
    fun pushCarDebounced()           = schedulePush("ls:homer-car")        { pushCar() }
    fun pushKanbanDebounced()        = schedulePush("android:kanban")      { pushKanban() }
    fun pushLifeGoalsDebounced()     = schedulePush("android:life-goals")  { pushLifeGoals() }

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
    }

    /** Push Pomodoro tasks immediately — called on delete so Supabase is updated before any pull. */
    suspend fun pushPomodoroTasksNow() {
        if (!supabase.isBogdan()) return
        runCatching { pushPomodoroTasks() }
    }

    // ── Expenses ─────────────────────────────────────────────────────────────
    // Website format: [{id, description, amount, category, date, note, type}]
    // Android Expense entity fields match — sync is straightforward.

    private suspend fun pushExpenses() {
        val expenses = db.expenseDao().getAll().first()
        supabase.setFieldState("ls:homer-expenses",
            json.encodeToString(ListSerializer(Expense.serializer()), expenses))
        val budgets = db.expenseDao().getAllBudgets().first()
        supabase.setFieldState("ls:homer-expense-budgets",
            json.encodeToString(ListSerializer(Budget.serializer()), budgets))
    }

    private suspend fun pullExpenses() {
        supabase.getFieldState("ls:homer-expenses")?.let { row ->
            if (row.value.isBlank()) return@let
            val items = json.decodeFromString(ListSerializer(Expense.serializer()), row.value)
            db.expenseDao().upsertAll(items)
        }
        supabase.getFieldState("ls:homer-expense-budgets")?.let { row ->
            if (row.value.isBlank()) return@let
            val items = json.decodeFromString(ListSerializer(Budget.serializer()), row.value)
            db.expenseDao().upsertBudgets(items)
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
                    clientId = clientId,
                    name     = wh.name,
                    emoji    = wh.emoji,
                    color    = wh.color,
                    category = wh.category,
                    freq     = when (val f = wh.freq) {
                        is JsonPrimitive -> f.content
                        else            -> "daily"
                    },
                    target   = wh.target,
                    note     = wh.note,
                    archived = wh.archived,
                    createdAt = wh.created.takeIf { it > 0 } ?: System.currentTimeMillis(),
                )
            }
            db.habitDao().upsertAll(habits)

            // Sync completions — only for habits we just upserted
            val knownIds = habits.map { it.clientId }.toSet()
            val completions = blob.completions.mapNotNull { (key, value) ->
                val colon = key.lastIndexOf(':')
                if (colon < 1) return@mapNotNull null
                val habitId = key.substring(0, colon)
                val date    = key.substring(colon + 1)
                if (habitId !in knownIds) return@mapNotNull null
                val count = when (value) {
                    is JsonPrimitive ->
                        value.intOrNull ?: if (value.booleanOrNull == true) 1 else 0
                    else -> 1
                }
                if (count <= 0) null
                else HabitCompletion(habitClientId = habitId, date = date, count = count)
            }
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
            val tasks = wsTasks.map { wt ->
                PomodoroTask(
                    id        = wt.ts.toString().ifBlank { System.currentTimeMillis().toString() },
                    text      = wt.text,
                    done      = wt.done,
                    createdAt = wt.ts,
                    updatedAt = wt.ts,
                )
            }
            // Full replace — server is source of truth; prevents zombie tasks after local deletion
            db.pomodoroDao().clearAllTasks()
            db.pomodoroDao().upsertAllTasks(tasks)
        }
    }

    // ── Notes ─────────────────────────────────────────────────────────────────
    // Website key: "homer-notes"
    // Format: [{id, title, content, emoji, parentId, pinned, createdAt, updatedAt}]
    // Android Note entity fields match directly — straightforward sync.

    private suspend fun pushNotes() {
        val notes = db.noteDao().getAll().first()
        supabase.setFieldState("ls:homer-notes",
            json.encodeToString(ListSerializer(Note.serializer()), notes))
    }

    private suspend fun pullNotes() {
        supabase.getFieldState("ls:homer-notes")?.let { row ->
            if (row.value.isBlank()) return@let
            val notes = json.decodeFromString(ListSerializer(Note.serializer()), row.value)
            if (notes.isNotEmpty()) db.noteDao().upsertAll(notes)
        }
    }

    // ── Journal ───────────────────────────────────────────────────────────────
    // Website key: "homer-journal" → Supabase field_id: "ls:homer-journal"
    // Format: [{id, date, content, mood, moodLabel, aiReflection, wordCount, createdAt, updatedAt}]

    private suspend fun pushJournal() {
        val entries = db.journalDao().getAll().first()
        supabase.setFieldState("ls:homer-journal",
            json.encodeToString(ListSerializer(JournalEntry.serializer()), entries))
    }

    private suspend fun pullJournal() {
        supabase.getFieldState("ls:homer-journal")?.let { row ->
            if (row.value.isBlank()) return@let
            val entries = json.decodeFromString(ListSerializer(JournalEntry.serializer()), row.value)
            if (entries.isNotEmpty()) entries.forEach { db.journalDao().upsert(it) }
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
            blob.vehicles.forEach    { db.carDao().upsertVehicle(it) }
            blob.documents.forEach   { db.carDao().upsertDocument(it) }
            blob.maintenance.forEach { db.carDao().upsertMaintenance(it) }
            blob.fuel.forEach        { db.carDao().upsertFuelLog(it) }
        }
    }

    // ── Kanban ────────────────────────────────────────────────────────────────
    // Field IDs: "android:kanban-projects" and "android:kanban-tasks"
    // Format: plain JSON arrays of KanbanProject / KanbanTask

    @Serializable
    private data class KanbanBlob(
        val projects: List<KanbanProject> = emptyList(),
        val tasks: List<KanbanTask> = emptyList(),
    )

    private suspend fun pushKanban() {
        val projects = db.kanbanDao().getAllProjects().first()
        val tasks    = db.kanbanDao().getAllTasks().first()
        val blob = KanbanBlob(projects = projects, tasks = tasks)
        supabase.setFieldState("android:kanban", json.encodeToString(KanbanBlob.serializer(), blob))
    }

    private suspend fun pullKanban() {
        supabase.getFieldState("android:kanban")?.let { row ->
            if (row.value.isBlank()) return@let
            val blob = json.decodeFromString(KanbanBlob.serializer(), row.value)
            if (blob.projects.isNotEmpty()) db.kanbanDao().upsertProjects(blob.projects)
            if (blob.tasks.isNotEmpty()) db.kanbanDao().upsertTasks(blob.tasks)
        }
    }

    // ── Life Goals ────────────────────────────────────────────────────────────
    // Field ID: "android:life-goals"
    // Format: plain JSON array of LifeGoal

    private suspend fun pushLifeGoals() {
        val goals = db.lifeGoalDao().getAll().first()
        supabase.setFieldState("android:life-goals",
            json.encodeToString(ListSerializer(LifeGoal.serializer()), goals))
    }

    private suspend fun pullLifeGoals() {
        supabase.getFieldState("android:life-goals")?.let { row ->
            if (row.value.isBlank()) return@let
            val goals = json.decodeFromString(ListSerializer(LifeGoal.serializer()), row.value)
            if (goals.isNotEmpty()) db.lifeGoalDao().upsertAll(goals)
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Stable, reproducible ID derived from url + name (for links pulled from website). */
    private fun stableId(url: String, name: String): String =
        (url.trimEnd('/') + "|" + name).hashCode().toLong()
            .let { if (it < 0) it + Long.MAX_VALUE else it }
            .toString()
}
