package ro.b4it.homer.data.sync

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import ro.b4it.homer.data.local.HomerDatabase
import ro.b4it.homer.data.local.entity.*
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LocalBackupManager @Inject constructor(
    @ApplicationContext private val ctx: Context,
    private val db: HomerDatabase,
) {
    private val json = Json { prettyPrint = false; ignoreUnknownKeys = true }
    private val backupsDir get() = File(ctx.filesDir, "backups").also { it.mkdirs() }

    data class BackupSummary(
        val filename: String,
        val sizeKb: Long,
        val createdAt: Long,
        val file: File,
    )

    suspend fun createBackup(): File = withContext(Dispatchers.IO) {
        val stamp = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.getDefault()).format(Date())
        val zipFile = File(backupsDir, "homer-$stamp.zip")

        ZipOutputStream(FileOutputStream(zipFile)).use { zip ->
            val dump = buildDump()
            zip.putNextEntry(ZipEntry("homer-data.json"))
            zip.write(json.encodeToString(DataDump.serializer(), dump).toByteArray(Charsets.UTF_8))
            zip.closeEntry()
        }

        // Keep last 7 backups
        listBackups().drop(7).forEach { it.file.delete() }

        zipFile
    }

    fun listBackups(): List<BackupSummary> =
        (backupsDir.listFiles { f -> f.name.endsWith(".zip") } ?: emptyArray())
            .sortedByDescending { it.lastModified() }
            .map { f ->
                BackupSummary(
                    filename  = f.name,
                    sizeKb    = f.length() / 1024,
                    createdAt = f.lastModified(),
                    file      = f,
                )
            }

    private suspend fun buildDump(): DataDump = DataDump(
        generatedAt    = System.currentTimeMillis(),
        expenses       = db.expenseDao().getAll().first(),
        budgets        = db.expenseDao().getAllBudgets().first(),
        habits         = db.habitDao().getAllHabits().first(),
        completions    = db.habitDao().getCompletionsSince("2000-01-01").first(),
        inbox          = db.inboxDao().getAll().first(),
        links          = db.linkDao().getAll().first(),
        pomodoroTasks  = db.pomodoroDao().getAllTasks().first(),
        notes          = db.noteDao().getAll().first(),
        journal        = db.journalDao().getAll().first(),
        kanbanProjects = db.kanbanDao().getAllProjects().first(),
        kanbanTasks    = db.kanbanDao().getAllTasks().first(),
        lifeGoals      = db.lifeGoalDao().getAll().first(),
        carVehicles    = db.carDao().getVehicles().first(),
        carDocuments   = db.carDao().getAllDocuments().first(),
        carMaintenance = db.carDao().getAllMaintenance().first(),
        carFuel        = db.carDao().getAllFuelLog().first(),
    )

    @Serializable
    data class DataDump(
        val version: Int = 1,
        val generatedAt: Long = 0L,
        val expenses: List<Expense> = emptyList(),
        val budgets: List<Budget> = emptyList(),
        val habits: List<Habit> = emptyList(),
        val completions: List<HabitCompletion> = emptyList(),
        val inbox: List<InboxItem> = emptyList(),
        val links: List<Link> = emptyList(),
        val pomodoroTasks: List<PomodoroTask> = emptyList(),
        val notes: List<Note> = emptyList(),
        val journal: List<JournalEntry> = emptyList(),
        val kanbanProjects: List<KanbanProject> = emptyList(),
        val kanbanTasks: List<KanbanTask> = emptyList(),
        val lifeGoals: List<LifeGoal> = emptyList(),
        val carVehicles: List<CarVehicle> = emptyList(),
        val carDocuments: List<CarDocument> = emptyList(),
        val carMaintenance: List<CarMaintenance> = emptyList(),
        val carFuel: List<CarFuelLog> = emptyList(),
    )
}
