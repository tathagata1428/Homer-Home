package ro.b4it.homer.ui.screens.reminders

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.horizontalScroll
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

private val FMT = SimpleDateFormat("EEE, MMM d  HH:mm", Locale.getDefault())
private val RECUR_OPTIONS = listOf("none", "daily", "weekly", "monthly", "yearly")

@Composable
fun RemindersScreen(vm: RemindersViewModel = hiltViewModel()) {
    val reminders by vm.reminders.collectAsStateWithLifecycle(emptyList())
    var showAdd by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp, 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Reminders",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = { showAdd = true }) {
                Icon(Icons.Filled.Add, null, tint = AccentBlue)
            }
        }

        if (reminders.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("🔔", fontSize = 40.sp)
                    Text("No reminders yet", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                    TextButton(onClick = { showAdd = true }) { Text("Add reminder", color = AccentBlue) }
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(reminders, key = { it.id }) { rem ->
                    ReminderCard(reminder = rem, onToggle = { vm.toggle(rem) }, onDelete = { vm.delete(rem) })
                }
            }
        }
    }

    if (showAdd) {
        AddReminderDialog(onAdd = vm::add, onDismiss = { showAdd = false })
    }
}

@Composable
private fun ReminderCard(reminder: Reminder, onToggle: () -> Unit, onDelete: () -> Unit) {
    HomerCard {
        Row(
            Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    reminder.title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = if (reminder.enabled) TextPrimary else TextSubtle,
                )
                if (reminder.body.isNotBlank()) {
                    Text(
                        reminder.body,
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                        maxLines = 1,
                    )
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        FMT.format(Date(reminder.triggerAt)),
                        style = MaterialTheme.typography.labelSmall,
                        color = AccentBlue,
                    )
                    if (reminder.recurType != "none") {
                        Box(
                            Modifier.clip(RoundedCornerShape(4.dp))
                                .background(AccentViolet.copy(alpha = 0.15f))
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                        ) {
                            Text(
                                "↻ ${reminder.recurType}",
                                style = MaterialTheme.typography.labelSmall,
                                color = AccentViolet,
                            )
                        }
                    }
                }
            }
            Switch(
                checked = reminder.enabled,
                onCheckedChange = { onToggle() },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = androidx.compose.ui.graphics.Color.White,
                    checkedTrackColor = AccentBlue,
                ),
                modifier = Modifier.padding(horizontal = 4.dp),
            )
            IconButton(onClick = onDelete, Modifier.size(32.dp)) {
                Icon(Icons.Filled.Delete, null, tint = AccentRed.copy(alpha = 0.7f), modifier = Modifier.size(18.dp))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddReminderDialog(onAdd: (String, String, Long, String) -> Unit, onDismiss: () -> Unit) {
    var title by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var recurType by remember { mutableStateOf("none") }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    val now = Calendar.getInstance()
    val datePickerState = rememberDatePickerState(
        initialSelectedDateMillis = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }.timeInMillis,
    )
    val timePickerState = rememberTimePickerState(
        initialHour = now.get(Calendar.HOUR_OF_DAY),
        initialMinute = now.get(Calendar.MINUTE),
    )

    val displayDate = datePickerState.selectedDateMillis?.let {
        val utcCal = Calendar.getInstance(TimeZone.getTimeZone("UTC")).also { c -> c.timeInMillis = it }
        "%02d/%02d/%04d".format(
            utcCal.get(Calendar.DAY_OF_MONTH),
            utcCal.get(Calendar.MONTH) + 1,
            utcCal.get(Calendar.YEAR),
        )
    } ?: "Select date"

    val displayTime = "%02d:%02d".format(timePickerState.hour, timePickerState.minute)

    // Date picker dialog
    if (showDatePicker) {
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("OK", color = AccentBlue) }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel", color = TextMuted) }
            },
            colors = DatePickerDefaults.colors(containerColor = BgCard),
        ) {
            DatePicker(state = datePickerState)
        }
        return
    }

    // Time picker dialog
    if (showTimePicker) {
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            containerColor = BgCard,
            confirmButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("OK", color = AccentBlue) }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("Cancel", color = TextMuted) }
            },
            title = { Text("Select Time") },
            text = {
                TimePicker(
                    state = timePickerState,
                    colors = TimePickerDefaults.colors(
                        clockDialColor = BgCardAlt,
                        selectorColor = AccentBlue,
                        clockDialSelectedContentColor = TextPrimary,
                        clockDialUnselectedContentColor = TextMuted,
                        periodSelectorBorderColor = BorderDefault,
                    ),
                )
            },
        )
        return
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = BgCard,
        title = { Text("New Reminder", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = title, onValueChange = { title = it },
                    label = { Text("Title *") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = reminderFieldColors(),
                )
                OutlinedTextField(
                    value = body, onValueChange = { body = it },
                    label = { Text("Note (optional)") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = reminderFieldColors(),
                )

                // Date + Time row
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { showDatePicker = true },
                        modifier = Modifier.weight(1f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderDefault),
                    ) {
                        Icon(Icons.Filled.CalendarToday, null, modifier = Modifier.size(15.dp), tint = AccentBlue)
                        Spacer(Modifier.width(4.dp))
                        Text(displayDate, style = MaterialTheme.typography.labelSmall, color = TextPrimary)
                    }
                    OutlinedButton(
                        onClick = { showTimePicker = true },
                        modifier = Modifier.weight(1f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderDefault),
                    ) {
                        Icon(Icons.Filled.Schedule, null, modifier = Modifier.size(15.dp), tint = AccentBlue)
                        Spacer(Modifier.width(4.dp))
                        Text(displayTime, style = MaterialTheme.typography.labelSmall, color = TextPrimary)
                    }
                }

                // Recurrence
                Text("Repeat", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                ) {
                    RECUR_OPTIONS.forEach { opt ->
                        FilterChip(
                            selected = recurType == opt,
                            onClick = { recurType = opt },
                            label = { Text(opt, style = MaterialTheme.typography.labelSmall) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = AccentBlue.copy(alpha = 0.2f),
                                selectedLabelColor = AccentBlue,
                                containerColor = BgCardAlt,
                                labelColor = TextMuted,
                            ),
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                if (title.isBlank()) return@TextButton
                val dateMs = datePickerState.selectedDateMillis ?: System.currentTimeMillis()
                val utcCal = Calendar.getInstance(TimeZone.getTimeZone("UTC")).also { it.timeInMillis = dateMs }
                val triggerMs = Calendar.getInstance().apply {
                    set(
                        utcCal.get(Calendar.YEAR),
                        utcCal.get(Calendar.MONTH),
                        utcCal.get(Calendar.DAY_OF_MONTH),
                        timePickerState.hour,
                        timePickerState.minute,
                        0,
                    )
                    set(Calendar.MILLISECOND, 0)
                }.timeInMillis
                onAdd(title, body, triggerMs, recurType)
                onDismiss()
            }) { Text("Add", color = AccentBlue) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) }
        },
    )
}

@Composable
private fun reminderFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault,
    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
    focusedLabelColor = AccentBlue, unfocusedLabelColor = TextMuted,
)
