package ro.b4it.homer.ui.screens.reminders

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.Reminder
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

private val FMT = SimpleDateFormat("MMM d, yyyy  HH:mm", Locale.getDefault())
private val RECUR_OPTIONS = listOf("none", "daily", "weekly", "monthly", "yearly")

@Composable
fun RemindersScreen(vm: RemindersViewModel = hiltViewModel()) {
    val reminders by vm.reminders.collectAsStateWithLifecycle(emptyList())
    var showAdd   by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        Row(Modifier.fillMaxWidth().padding(16.dp, 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Reminders", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            IconButton(onClick = { showAdd = true }) { Icon(Icons.Filled.Add, null, tint = AccentBlue) }
        }

        if (reminders.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("🔔", fontSize = 40.sp)
                    Text("No reminders yet", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                    TextButton(onClick = { showAdd = true }) { Text("Add reminder", color = AccentBlue) }
                }
            }
        } else {
            LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(reminders) { rem ->
                    ReminderCard(reminder = rem, onToggle = { vm.toggle(rem) }, onDelete = { vm.delete(rem) })
                }
            }
        }
    }

    if (showAdd) AddReminderDialog(onAdd = vm::add, onDismiss = { showAdd = false })
}

@Composable
private fun ReminderCard(reminder: Reminder, onToggle: () -> Unit, onDelete: () -> Unit) {
    HomerCard {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(reminder.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold,
                    color = if (reminder.enabled) TextPrimary else TextSubtle)
                if (reminder.body.isNotBlank())
                    Text(reminder.body, style = MaterialTheme.typography.bodySmall, color = TextMuted, maxLines = 1)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(FMT.format(Date(reminder.triggerAt)), style = MaterialTheme.typography.labelSmall, color = AccentBlue)
                    if (reminder.recurType != "none") {
                        Box(Modifier.clip(RoundedCornerShape(4.dp)).background(AccentViolet.copy(0.15f)).padding(horizontal = 6.dp, vertical = 2.dp)) {
                            Text("↻ ${reminder.recurType}", style = MaterialTheme.typography.labelSmall, color = AccentViolet)
                        }
                    }
                }
            }
            Switch(
                checked = reminder.enabled, onCheckedChange = { onToggle() },
                colors = SwitchDefaults.colors(checkedThumbColor = androidx.compose.ui.graphics.Color.White, checkedTrackColor = AccentBlue),
                modifier = Modifier.padding(horizontal = 4.dp),
            )
            IconButton(onClick = onDelete, Modifier.size(28.dp)) {
                Icon(Icons.Filled.Delete, null, tint = AccentRed.copy(0.7f), modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
private fun AddReminderDialog(onAdd: (String, String, Long, String) -> Unit, onDismiss: () -> Unit) {
    var title    by remember { mutableStateOf("") }
    var body     by remember { mutableStateOf("") }
    var recurType by remember { mutableStateOf("none") }

    // Simple date/time picker via text fields
    val now = Calendar.getInstance()
    var dateStr by remember { mutableStateOf(
        "%04d-%02d-%02d".format(now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH))
    ) }
    var timeStr by remember { mutableStateOf("%02d:%02d".format(now.get(Calendar.HOUR_OF_DAY), now.get(Calendar.MINUTE))) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = BgCard,
        title = { Text("New Reminder") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple("Title *", title, { v: String -> title = v }),
                    Triple("Note (optional)", body, { v: String -> body = v }),
                    Triple("Date (YYYY-MM-DD)", dateStr, { v: String -> dateStr = v }),
                    Triple("Time (HH:MM)", timeStr, { v: String -> timeStr = v }),
                ).forEach { (lbl, value, setter) ->
                    OutlinedTextField(
                        value = value, onValueChange = setter,
                        label = { Text(lbl) }, singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault,
                            focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedLabelColor = AccentBlue,
                        ),
                    )
                }

                Text("Repeat", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                    RECUR_OPTIONS.forEach { opt ->
                        FilterChip(
                            selected = recurType == opt,
                            onClick = { recurType = opt },
                            label = { Text(opt, style = MaterialTheme.typography.labelSmall) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = AccentBlue.copy(0.2f), selectedLabelColor = AccentBlue,
                            ),
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                if (title.isBlank()) return@TextButton
                val triggerAt = parseDateTimeToMs(dateStr, timeStr) ?: return@TextButton
                onAdd(title, body, triggerAt, recurType)
                onDismiss()
            }) { Text("Add", color = AccentBlue) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } },
    )
}

private fun parseDateTimeToMs(dateStr: String, timeStr: String): Long? = try {
    val dp = dateStr.trim().split("-")
    val tp = timeStr.trim().split(":")
    Calendar.getInstance().apply {
        set(dp[0].toInt(), dp[1].toInt() - 1, dp[2].toInt(),
            tp[0].toInt(), tp[1].toInt(), 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
} catch (_: Exception) { null }
