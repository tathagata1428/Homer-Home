package ro.b4it.homer.ui.screens.sync

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ro.b4it.homer.data.supabase.SupabaseManager
import ro.b4it.homer.data.sync.ConflictInfo
import ro.b4it.homer.data.sync.LocalBackupManager
import ro.b4it.homer.data.sync.SyncEngine
import ro.b4it.homer.data.sync.SyncResolution
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

// ── Sync scope items ──────────────────────────────────────────────────────────

data class SyncScopeItem(val key: String, val emoji: String, val label: String)

// ── Phase sealed class ────────────────────────────────────────────────────────

sealed class SyncPhase {
    object Idle : SyncPhase()
    object Detecting : SyncPhase()
    data class AwaitingResolution(
        val conflicts: List<ConflictInfo>,
        val index: Int,
    ) : SyncPhase()
    object Applying : SyncPhase()
    object CreatingBackup : SyncPhase()
}

// ── State ─────────────────────────────────────────────────────────────────────

data class SyncState(
    val isBogdan: Boolean = false,
    val phase: SyncPhase = SyncPhase.Idle,
    val pendingResolutions: Map<String, SyncResolution> = emptyMap(),
    val lastSyncAt: String? = null,
    val error: String? = null,
    val backups: List<LocalBackupManager.BackupSummary> = emptyList(),
    val syncScope: Map<String, Boolean> = emptyMap(),
)

// ── ViewModel ─────────────────────────────────────────────────────────────────

@HiltViewModel
class SyncViewModel @Inject constructor(
    @ApplicationContext private val ctx: Context,
    private val supabase: SupabaseManager,
    private val sync: SyncEngine,
    private val backupManager: LocalBackupManager,
) : ViewModel() {

    private val _state = MutableStateFlow(
        SyncState(
            isBogdan  = supabase.isBogdan(),
            backups   = backupManager.listBackups(),
            syncScope = loadSyncScope(),
        )
    )
    val state: StateFlow<SyncState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            supabase.sessionStatus.collect { status ->
                _state.update { it.copy(isBogdan = status is SessionStatus.Authenticated && supabase.isBogdan()) }
            }
        }
    }

    // ── Pull from cloud (with conflict detection) ─────────────────────────────

    fun startPull() {
        viewModelScope.launch {
            _state.update { it.copy(phase = SyncPhase.Detecting, error = null) }
            try {
                val conflicts = sync.detectConflicts()
                if (conflicts.isEmpty()) {
                    applyPull(emptyMap())
                } else {
                    _state.update { it.copy(
                        phase              = SyncPhase.AwaitingResolution(conflicts, 0),
                        pendingResolutions = emptyMap(),
                    ) }
                }
            } catch (e: Exception) {
                _state.update { it.copy(phase = SyncPhase.Idle, error = e.message ?: e.toString()) }
            }
        }
    }

    /** Called from UI when user picks a resolution for the current conflict. */
    fun resolveConflict(fieldKey: String, resolution: SyncResolution) {
        val phase = _state.value.phase as? SyncPhase.AwaitingResolution ?: return
        val updated = _state.value.pendingResolutions + (fieldKey to resolution)
        val next = phase.index + 1
        if (next >= phase.conflicts.size) {
            applyPull(updated)
        } else {
            _state.update { it.copy(
                phase              = SyncPhase.AwaitingResolution(phase.conflicts, next),
                pendingResolutions = updated,
            ) }
        }
    }

    private fun applyPull(resolutions: Map<String, SyncResolution>) {
        viewModelScope.launch {
            _state.update { it.copy(phase = SyncPhase.Applying, pendingResolutions = emptyMap()) }
            try {
                sync.pullWithResolutions(resolutions)
                doBackup()
                _state.update { it.copy(phase = SyncPhase.Idle, lastSyncAt = timestamp()) }
            } catch (e: Exception) {
                _state.update { it.copy(phase = SyncPhase.Idle, error = e.message ?: e.toString()) }
            }
        }
    }

    // ── Push to cloud ─────────────────────────────────────────────────────────

    fun pushToCloud() {
        viewModelScope.launch {
            _state.update { it.copy(phase = SyncPhase.Applying, error = null) }
            try {
                doBackup()                  // backup before any destructive push
                sync.pushAll()
                _state.update { it.copy(phase = SyncPhase.Idle, lastSyncAt = timestamp()) }
            } catch (e: Exception) {
                _state.update { it.copy(phase = SyncPhase.Idle, error = e.message ?: e.toString()) }
            }
        }
    }

    // ── Local backup ──────────────────────────────────────────────────────────

    fun createBackupNow() {
        viewModelScope.launch {
            doBackup()
        }
    }

    private suspend fun doBackup() {
        _state.update { it.copy(phase = SyncPhase.CreatingBackup) }
        runCatching { backupManager.createBackup() }
            .onFailure { _state.update { s -> s.copy(error = "Backup failed: ${it.message}") } }
        _state.update { it.copy(backups = backupManager.listBackups()) }
    }

    /** Returns a share Intent for the given backup file, or null if FileProvider fails. */
    fun shareIntent(summary: LocalBackupManager.BackupSummary): Intent? = runCatching {
        val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.provider", summary.file)
        Intent(Intent.ACTION_SEND).apply {
            type = "application/zip"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }.getOrNull()

    // ── Selective sync scope ──────────────────────────────────────────────────

    private fun loadSyncScope(): Map<String, Boolean> {
        val prefs = ctx.getSharedPreferences(SYNC_PREFS, Context.MODE_PRIVATE)
        return SYNC_SCOPE.associate { it.key to prefs.getBoolean(it.key, true) }
    }

    fun toggleSyncField(key: String) {
        val prefs = ctx.getSharedPreferences(SYNC_PREFS, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(key, !prefs.getBoolean(key, true)).apply()
        _state.update { it.copy(syncScope = loadSyncScope()) }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun timestamp() =
        SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())

    companion object {
        const val SYNC_PREFS = "homer_sync_scope"
        val SYNC_SCOPE = listOf(
            SyncScopeItem("ls:homer-habits",    "✅", "Habits"),
            SyncScopeItem("ls:homer-notes",     "📝", "Notes"),
            SyncScopeItem("ls:homer-life-goals", "🎯", "Life Goals"),
            SyncScopeItem("ls:homer-kanban",    "📋", "Kanban"),
            SyncScopeItem("ls:homer-expenses",  "💰", "Expenses"),
            SyncScopeItem("ls:homer-inbox",     "📥", "Inbox"),
            SyncScopeItem("ls:homer-links",     "🔗", "Links"),
            SyncScopeItem("ls:homer-journal",   "📔", "Journal"),
            SyncScopeItem("ls:pom-tasks",       "⏱", "Focus Tasks"),
            SyncScopeItem("ls:homer-car",       "🚗", "Car Data"),
        )
    }
}
