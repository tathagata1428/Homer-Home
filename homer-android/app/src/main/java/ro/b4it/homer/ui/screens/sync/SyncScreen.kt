package ro.b4it.homer.ui.screens.sync

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.sync.LocalBackupManager
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun SyncScreen(vm: SyncViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val ctx   = LocalContext.current
    val phase = state.phase

    LazyColumn(
        modifier            = Modifier.fillMaxSize().background(BgPrimary),
        contentPadding      = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // ── Header ──────────────────────────────────────────────────────────
        item {
            Text(
                "Sync & Backup",
                style      = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color      = TextPrimary,
            )
        }

        // ── Status card ──────────────────────────────────────────────────────
        item {
            HomerCard {
                Row(
                    Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment    = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    val active = state.isBogdan
                    Box(
                        Modifier.size(44.dp).clip(RoundedCornerShape(12.dp))
                            .background((if (active) AccentGreen else TextSubtle).copy(0.15f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            if (active) Icons.Filled.CloudDone else Icons.Filled.CloudOff,
                            null,
                            tint     = if (active) AccentGreen else TextSubtle,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                    Column(Modifier.weight(1f)) {
                        Text(
                            if (active) "Cloud Sync Active" else "Sync Unavailable",
                            style      = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color      = TextPrimary,
                        )
                        Text(
                            if (active) "Via CF Pages /api/sync" else "Admin hash not configured",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextMuted,
                        )
                        Text(
                            state.lastSyncAt?.let { "Last sync: $it" } ?: "Not synced yet",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextMuted,
                        )
                    }
                    // Phase indicator
                    when (phase) {
                        is SyncPhase.Syncing, is SyncPhase.CreatingBackup ->
                            CircularProgressIndicator(Modifier.size(20.dp), color = NeonCyan, strokeWidth = 2.dp)
                        else -> {}
                    }
                }
            }
        }

        // ── Error ────────────────────────────────────────────────────────────
        if (state.error != null) {
            item {
                HomerCard {
                    Row(
                        Modifier.fillMaxWidth().padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment     = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Filled.ErrorOutline, null, tint = AccentRed, modifier = Modifier.size(18.dp))
                        Text(state.error!!, style = MaterialTheme.typography.labelSmall, color = AccentRed, modifier = Modifier.weight(1f))
                    }
                }
            }
        }

        // ── Phase label ──────────────────────────────────────────────────────
        val phaseLabel = when (phase) {
            is SyncPhase.Syncing        -> "Syncing..."
            is SyncPhase.CreatingBackup -> "Creating backup..."
            else -> null
        }
        if (phaseLabel != null) {
            item {
                Text(phaseLabel, style = MaterialTheme.typography.labelSmall, color = NeonCyan,
                    modifier = Modifier.padding(horizontal = 4.dp))
            }
        }

        // ── Action buttons ───────────────────────────────────────────────────
        item {
            val busy = phase !is SyncPhase.Idle
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    onClick  = vm::startPull,
                    enabled  = state.isBogdan && !busy,
                    modifier = Modifier.fillMaxWidth(),
                    colors   = ButtonDefaults.buttonColors(containerColor = NeonPink),
                ) {
                    Icon(Icons.Filled.CloudDownload, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Pull from Cloud", fontWeight = FontWeight.SemiBold)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(
                        onClick  = vm::pushToCloud,
                        enabled  = state.isBogdan && !busy,
                        modifier = Modifier.weight(1f),
                        colors   = ButtonDefaults.outlinedButtonColors(contentColor = NeonCyan),
                        border   = androidx.compose.foundation.BorderStroke(1.dp, NeonCyan.copy(0.5f)),
                    ) {
                        Icon(Icons.Filled.CloudUpload, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Push to Cloud", fontSize = 13.sp)
                    }
                    OutlinedButton(
                        onClick  = vm::createBackupNow,
                        enabled  = !busy,
                        modifier = Modifier.weight(1f),
                        colors   = ButtonDefaults.outlinedButtonColors(contentColor = NeonGold),
                        border   = androidx.compose.foundation.BorderStroke(1.dp, NeonGold.copy(0.5f)),
                    ) {
                        Icon(Icons.Filled.Archive, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Backup Now", fontSize = 13.sp)
                    }
                }
            }
        }

        // ── Sync scope ───────────────────────────────────────────────────────
        item {
            HomerCard {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        "SYNC SCOPE",
                        style         = MaterialTheme.typography.labelSmall,
                        fontWeight    = FontWeight.SemiBold,
                        color         = TextMuted,
                        letterSpacing = 2.sp,
                        modifier      = Modifier.padding(bottom = 4.dp),
                    )
                    SyncViewModel.SYNC_SCOPE.forEach { item ->
                        val enabled = state.syncScope[item.key] != false
                        Row(
                            Modifier.fillMaxWidth(),
                            verticalAlignment     = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                "${item.emoji}  ${item.label}",
                                style  = MaterialTheme.typography.bodySmall,
                                color  = if (enabled) TextPrimary else TextMuted,
                            )
                            Switch(
                                checked         = enabled,
                                onCheckedChange = { vm.toggleSyncField(item.key) },
                                modifier        = Modifier.height(24.dp),
                                colors          = SwitchDefaults.colors(
                                    checkedThumbColor       = NeonCyan,
                                    checkedTrackColor       = NeonCyan.copy(0.3f),
                                    uncheckedThumbColor     = TextMuted,
                                    uncheckedTrackColor     = TextMuted.copy(0.2f),
                                ),
                            )
                        }
                    }
                }
            }
        }

        // ── Backup history ───────────────────────────────────────────────────
        item {
            Text("Local Backups", style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold, color = TextPrimary,
                modifier = Modifier.padding(top = 4.dp))
        }

        if (state.backups.isEmpty()) {
            item {
                HomerCard {
                    Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                        Text("No backups yet. Pull or tap Backup Now to create one.",
                            style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    }
                }
            }
        } else {
            items(state.backups) { backup ->
                BackupRow(
                    backup = backup,
                    onExport = {
                        vm.shareIntent(backup)?.let { intent ->
                            ctx.startActivity(Intent.createChooser(intent, "Export backup"))
                        }
                    },
                )
            }
        }

        item { Spacer(Modifier.height(24.dp)) }
    }
}

// ── Backup row ────────────────────────────────────────────────────────────────

@Composable
private fun BackupRow(backup: LocalBackupManager.BackupSummary, onExport: () -> Unit) {
    HomerCard {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment     = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(Icons.Filled.Folder, null, tint = NeonGold.copy(0.8f), modifier = Modifier.size(20.dp))
            Column(Modifier.weight(1f)) {
                Text(backup.filename, style = MaterialTheme.typography.labelMedium,
                    color = TextPrimary, fontWeight = FontWeight.Medium)
                Text(
                    "${backup.sizeKb} KB · ${formatTs(backup.createdAt)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = TextMuted,
                )
            }
            IconButton(onClick = onExport, modifier = Modifier.size(36.dp)) {
                Icon(Icons.Filled.Share, "Export", tint = NeonCyan, modifier = Modifier.size(18.dp))
            }
        }
    }
}

private fun formatTs(ms: Long): String =
    SimpleDateFormat("MMM d, HH:mm", Locale.getDefault()).format(Date(ms))
