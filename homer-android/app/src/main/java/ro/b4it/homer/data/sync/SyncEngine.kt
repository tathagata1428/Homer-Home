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

    /** Auto-pull on sign-in so Room is immediately up to date with Supabase. */
    fun start() {
        scope.launch {
            runCatching { pullAll() }
                .onFailure { Log.e("HomerSync", "start: pullAll failed", it) }
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
        Log.d("HomerSync", "pullAll: done")
    }

    // ---- Debounced push ----

    /** Returns false if the user has disabled sync for this field. Default = enabled. */
    fun isFieldEnabled(fieldKey: String): Boolean =
        ctx.getSharedPreferences("homer_sync_scope", Context.MODE_PRIVATE)
            .getBoolean(fieldKey, true)

    fun schedulePush(fieldKey: String, push: suspend () -> Unit) {
        if (!supabase.isBogdan()) return
        if (!isFieldEnabled(fieldKey)) return
        synchronized(pendingJobs) {
            pendingJobs[fieldKey]?.cancel()
            pendingJobs[fieldKey] = scope.launch {
                delay(DEBOUNCE_MS)
                runCatching {
                    supabase.ensureSignedIn()
                    push()
                }.onFailure { Log.e("HomerSync", "schedulePush[$fieldKey] failed", it) }
            }
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
    fun pushKanbanDebounced()        = schedulePush("ls:homer-kanban")        { pushKanban() }
    fun pushLifeGoalsDebounced()     = schedulePush("ls:homer-life-goals")    { pushLifeGoals() }
    fun pushBrainDumpDebounced()     = schedulePush("ls:homer-brain-dump")   { pushBrainDump() }
    fun pushZenGoalDebounced()       = schedulePush("ls:homer-zen-goal")     { pushZenGoal() }

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
            val cloudItems = json.decodeFromString(ListSerializer(Expense.serializer()), row.value)
            val toMerge = mergeByUpdatedAt(cloudItems, db.expenseDao().getAll().first(), { it.id }, { it.updatedAt })
            if (toMerge.isNotEmpty()) db.expenseDao().upsertAll(toMerge)
        }
        supabase.getFieldState("ls:homer-expense-budgets")?.let { row ->
            if (row.value.isBlank()) return@let
            val cloudBudgets = json.decodeFromString(ListSerializer(Budget.serializer()), row.value)
            val toMerge = mergeByUpdatedAt(cloudBudgets, db.expenseDao().getAllBudgets().first(), { it.category }, { it.updatedAt })
            if (toMerge.isNotEmpty()) db.expenseDao().upsertBudgets(toMerge)
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
            val toMerge = mergeByUpdatedAt(habits, db.habitDao().getAllHabits().first(), { it.clientId }, { it.updatedAt })
            if (toMerge.isNotEmpty()) db.habitDao().upsertAll(toMerge)

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
            // Per-item merge — local edits win if newer; note: remote deletions won't propagate without soft-delete
            val toMerge = mergeByUpdatedAt(tasks, db.pomodoroDao().getAllTasks().first(), { it.id }, { it.updatedAt })
            if (toMerge.isNotEmpty()) db.pomodoroDao().upsertAllTasks(toMerge)
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
        val ts = when {
            updatedAt > 0 -> updatedAt
            updated.isNotBlank() -> parseIsoMs(updated)
            else -> System.currentTimeMillis()
        }
        val tsCreated = when {
            createdAt > 0 -> createdAt
            created.isNotBlank() -> parseIsoMs(created)
            else -> ts
        }
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
            val toMerge = mergeByUpdatedAt(cloudNotes, db.noteDao().getAll().first(), { it.id }, { it.updatedAt })
            if (toMerge.isNotEmpty()) db.noteDao().upsertAll(toMerge)
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
            val toMerge = mergeByUpdatedAt(cloudEntries, db.journalDao().getAll().first(), { it.id }, { it.updatedAt })
            toMerge.forEach { db.journalDao().upsert(it) }
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
            mergeByUpdatedAt(blob.vehicles, db.carDao().getVehicles().first(), { it.id }, { it.updatedAt })
                .forEach { db.carDao().upsertVehicle(it) }
            mergeByUpdatedAt(blob.documents, db.carDao().getAllDocuments().first(), { it.id }, { it.updatedAt })
                .forEach { db.carDao().upsertDocument(it) }
            mergeByUpdatedAt(blob.maintenance, db.carDao().getAllMaintenance().first(), { it.id }, { it.updatedAt })
                .forEach { db.carDao().upsertMaintenance(it) }
            // CarFuelLog has no updatedAt — entries are immutable log records, always upsert
            blob.fuel.forEach { db.carDao().upsertFuelLog(it) }
        }
    }

    // ── Kanban ────────────────────────────────────────────────────────────────
    // Field ID: "ls:homer-kanban" (matches web convention)
    // Android push format: {projects:[KanbanProject...], tasks:[KanbanTask...]}
    // Web vault format:    {projects:[...], goals:[{id(int), col, summary, notes, due, ...}]}
    // Bridge classes handle both — col/column, due/dueDate, goals/tasks, int/UUID ids.

    // Push: Android-native format
    @Serializable
    private data class KanbanBlob(
        val projects: List<KanbanProject> = emptyList(),
        val tasks: List<KanbanTask> = emptyList(),
    )

    // Pull: tolerates both Android format (tasks) and web vault format (goals, col, due, int ids)
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
        val blob = KanbanBlob(projects = projects, tasks = tasks)
        supabase.setFieldState("ls:homer-kanban", json.encodeToString(KanbanBlob.serializer(), blob))
    }

    private suspend fun pullKanban() {
        supabase.getFieldState("ls:homer-kanban")?.let { row ->
            if (row.value.isBlank()) return@let
            val blob     = json.decodeFromString(KanbanBlobWs.serializer(), row.value)
            val allTasks = blob.tasks + blob.goals  // union: android-push tasks + web-vault goals
            val projects = blob.projects.map { it.toProject() }
            val tasks    = allTasks.map { it.toTask() }
            mergeByUpdatedAt(projects, db.kanbanDao().getAllProjects().first(), { it.id }, { it.updatedAt })
                .takeIf { it.isNotEmpty() }?.let { db.kanbanDao().upsertProjects(it) }
            mergeByUpdatedAt(tasks, db.kanbanDao().getAllTasks().first(), { it.id }, { it.updatedAt })
                .takeIf { it.isNotEmpty() }?.let { db.kanbanDao().upsertTasks(it) }
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
        supabase.setFieldState("ls:homer-life-goals",
            json.encodeToString(ListSerializer(LifeGoal.serializer()), goals))
    }

    private suspend fun pullLifeGoals() {
        supabase.getFieldState("ls:homer-life-goals")?.let { row ->
            if (row.value.isBlank()) return@let
            val wsGoals = json.decodeFromString(ListSerializer(WsLifeGoal.serializer()), row.value)
            val goals   = wsGoals.map { it.toLifeGoal() }
            val toMerge = mergeByUpdatedAt(goals, db.lifeGoalDao().getAll().first(), { it.id }, { it.updatedAt })
            if (toMerge.isNotEmpty()) db.lifeGoalDao().upsertAll(toMerge)
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

    // ── Conflict detection ────────────────────────────────────────────────────

    /**
     * Fetch cloud counts for each synced field and compare to local Room counts.
     * Returns one [ConflictInfo] per field where the counts differ and cloud is non-empty.
     * Call this before pulling to decide whether to prompt the user for resolution.
     */
    suspend fun detectConflicts(): List<ConflictInfo> {
        supabase.ensureSignedIn()
        if (!supabase.isBogdan()) return emptyList()
        val result = mutableListOf<ConflictInfo>()

        fun add(key: String, label: String, emoji: String, local: Int, cloud: Int) {
            if (cloud > 0 && local != cloud) result += ConflictInfo(key, label, emoji, local, cloud)
        }

        runCatching {
            val local = db.expenseDao().getAll().first().size
            val cloud = supabase.getFieldState("ls:homer-expenses")?.let { row ->
                if (row.value.isBlank()) return@let 0
                json.decodeFromString(ListSerializer(Expense.serializer()), row.value).size
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
        if (!supabase.isBogdan()) return

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
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Stable, reproducible ID derived from url + name (for links pulled from website). */
    private fun stableId(url: String, name: String): String =
        (url.trimEnd('/') + "|" + name).hashCode().toLong()
            .let { if (it < 0) it + Long.MAX_VALUE else it }
            .toString()

    /**
     * Per-item merge: from [cloudItems] keep only items that are strictly newer than their
     * local counterpart (by [getUpdatedAt]), or absent locally entirely.
     *
     * Items where local.updatedAt >= cloud.updatedAt are skipped — the local version wins.
     * This means concurrent edits on phone and website both survive: each device only
     * overwrites items it has a more recent version of.
     *
     * Limitation: remote deletions don't propagate — without soft-delete tombstones, a delete
     * on one side will be resurrected by the other side's next push.
     */
    private fun <T> mergeByUpdatedAt(
        cloudItems: List<T>,
        localItems: List<T>,
        getId: (T) -> String,
        getUpdatedAt: (T) -> Long,
    ): List<T> {
        if (cloudItems.isEmpty()) return emptyList()
        val localMap = localItems.associateBy(getId)
        return cloudItems.filter { cloud ->
            val local = localMap[getId(cloud)]
            local == null || getUpdatedAt(cloud) > getUpdatedAt(local)
        }
    }
}
