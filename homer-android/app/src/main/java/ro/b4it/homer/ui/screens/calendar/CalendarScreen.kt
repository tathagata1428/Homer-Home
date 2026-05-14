package ro.b4it.homer.ui.screens.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.CalendarEvent
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

private val DAY_LABELS = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
private val FMT_TIME   = SimpleDateFormat("HH:mm", Locale.getDefault())
private val FMT_DATE   = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())

@Composable
fun CalendarScreen(vm: CalendarViewModel = hiltViewModel()) {
    val ym     by vm.selectedMonth.collectAsStateWithLifecycle()
    val events by vm.events.collectAsStateWithLifecycle(emptyList())
    var showAdd by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<Int?>(null) }   // selected day-of-month

    val year  = ym / 12
    val month = ym % 12

    val cal = Calendar.getInstance().apply { set(year, month, 1) }
    val daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
    // Monday-based offset
    val firstDow = ((cal.get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY + 7) % 7)

    val todayCal = Calendar.getInstance()
    val isCurrentMonth = todayCal.get(Calendar.YEAR) == year && todayCal.get(Calendar.MONTH) == month
    val todayDay = if (isCurrentMonth) todayCal.get(Calendar.DAY_OF_MONTH) else -1

    // Group events by day-of-month
    val eventsByDay: Map<Int, List<CalendarEvent>> = events.groupBy { e ->
        Calendar.getInstance().apply { timeInMillis = e.start }.get(Calendar.DAY_OF_MONTH)
    }

    val selectedEvents = if (selected != null) eventsByDay[selected] ?: emptyList() else
        events.sortedBy { it.start }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        // Header
        Row(
            Modifier.fillMaxWidth().padding(16.dp, 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = vm::prevMonth) { Icon(Icons.Filled.ChevronLeft, null, tint = TextMuted) }
            Text(
                SimpleDateFormat("MMMM yyyy", Locale.getDefault()).format(cal.time),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center,
                color = TextPrimary,
            )
            IconButton(onClick = vm::nextMonth) { Icon(Icons.Filled.ChevronRight, null, tint = TextMuted) }
            IconButton(onClick = { showAdd = true }) { Icon(Icons.Filled.Add, null, tint = AccentBlue) }
        }

        // Day labels
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
            DAY_LABELS.forEach { d ->
                Text(d, modifier = Modifier.weight(1f), textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelSmall, color = TextMuted)
            }
        }
        Spacer(Modifier.height(4.dp))

        // Grid
        val totalCells = firstDow + daysInMonth
        val rows = (totalCells + 6) / 7
        Column(Modifier.padding(horizontal = 8.dp)) {
            for (row in 0 until rows) {
                Row(Modifier.fillMaxWidth()) {
                    for (col in 0 until 7) {
                        val cell = row * 7 + col
                        val day  = cell - firstDow + 1
                        if (day < 1 || day > daysInMonth) {
                            Box(Modifier.weight(1f).height(40.dp))
                        } else {
                            val hasEvents = eventsByDay.containsKey(day)
                            val isToday   = day == todayDay
                            val isSel     = day == selected
                            Box(
                                Modifier.weight(1f).height(40.dp)
                                    .clip(CircleShape)
                                    .background(when {
                                        isSel   -> AccentBlue
                                        isToday -> AccentBlue.copy(alpha = 0.2f)
                                        else    -> androidx.compose.ui.graphics.Color.Transparent
                                    })
                                    .clickable { selected = if (selected == day) null else day },
                                contentAlignment = Alignment.Center,
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        day.toString(),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = when {
                                            isSel   -> androidx.compose.ui.graphics.Color.White
                                            isToday -> AccentBlue
                                            else    -> TextPrimary
                                        },
                                        fontWeight = if (isToday || isSel) FontWeight.Bold else FontWeight.Normal,
                                    )
                                    if (hasEvents) {
                                        Box(Modifier.size(4.dp).clip(CircleShape).background(
                                            if (isSel) androidx.compose.ui.graphics.Color.White else AccentBlue
                                        ))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        HorizontalDivider(Modifier.padding(vertical = 8.dp), color = BorderSubtle)

        // Events list
        if (selectedEvents.isEmpty()) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                Text(
                    if (selected != null) "No events on day $selected" else "No events this month",
                    color = TextMuted, style = MaterialTheme.typography.bodySmall,
                )
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(selectedEvents) { ev ->
                    EventRow(ev, onDelete = { vm.deleteEvent(ev) })
                }
            }
        }
    }

    if (showAdd) {
        AddEventDialog(
            onAdd = { title, startMs, endMs, loc, desc, allDay ->
                vm.addEvent(title, startMs, endMs, loc, desc, allDay)
                showAdd = false
            },
            onDismiss = { showAdd = false },
            defaultDay = selected ?: todayCal.get(Calendar.DAY_OF_MONTH),
            year = year, month = month,
        )
    }
}

@Composable
private fun EventRow(event: CalendarEvent, onDelete: () -> Unit) {
    HomerCard {
        Row(
            Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.width(4.dp).height(36.dp).clip(RoundedCornerShape(2.dp)).background(AccentBlue)
            )
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(event.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                val time = if (event.allDay) "All day" else
                    "${FMT_TIME.format(Date(event.start))} – ${FMT_TIME.format(Date(event.end))}"
                Text(time, style = MaterialTheme.typography.labelSmall, color = TextMuted)
                if (event.location.isNotBlank()) Text(event.location, style = MaterialTheme.typography.labelSmall, color = AccentBlue)
            }
            IconButton(onClick = onDelete, Modifier.size(28.dp)) {
                Icon(Icons.Filled.Delete, null, tint = AccentRed.copy(0.7f), modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
private fun AddEventDialog(
    onAdd: (String, Long, Long, String, String, Boolean) -> Unit,
    onDismiss: () -> Unit,
    defaultDay: Int, year: Int, month: Int,
) {
    var title   by remember { mutableStateOf("") }
    var loc     by remember { mutableStateOf("") }
    var desc    by remember { mutableStateOf("") }
    var allDay  by remember { mutableStateOf(false) }
    var startHH by remember { mutableStateOf("09") }
    var startMM by remember { mutableStateOf("00") }
    var endHH   by remember { mutableStateOf("10") }
    var endMM   by remember { mutableStateOf("00") }
    var dayStr  by remember { mutableStateOf(defaultDay.toString()) }

    fun buildMs(hh: String, mm: String): Long {
        val d = dayStr.toIntOrNull() ?: defaultDay
        return Calendar.getInstance().apply {
            set(year, month, d, hh.toIntOrNull() ?: 0, mm.toIntOrNull() ?: 0, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = BgCard,
        title = { Text("Add Event") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple("Title *", title, { v: String -> title = v }),
                    Triple("Day", dayStr, { v: String -> dayStr = v }),
                    Triple("Location", loc, { v: String -> loc = v }),
                    Triple("Description", desc, { v: String -> desc = v }),
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
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = allDay, onCheckedChange = { allDay = it }, colors = CheckboxDefaults.colors(checkedColor = AccentBlue))
                    Text("All day", color = TextPrimary, style = MaterialTheme.typography.bodySmall)
                }
                if (!allDay) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = startHH, onValueChange = { startHH = it },
                            label = { Text("Start HH") }, singleLine = true, modifier = Modifier.weight(1f),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary),
                        )
                        OutlinedTextField(
                            value = startMM, onValueChange = { startMM = it },
                            label = { Text("MM") }, singleLine = true, modifier = Modifier.weight(1f),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary),
                        )
                        OutlinedTextField(
                            value = endHH, onValueChange = { endHH = it },
                            label = { Text("End HH") }, singleLine = true, modifier = Modifier.weight(1f),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary),
                        )
                        OutlinedTextField(
                            value = endMM, onValueChange = { endMM = it },
                            label = { Text("MM") }, singleLine = true, modifier = Modifier.weight(1f),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary),
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                if (title.isNotBlank()) {
                    val d = dayStr.toIntOrNull() ?: defaultDay
                    val startMs = if (allDay) Calendar.getInstance().apply { set(year, month, d, 0, 0, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
                                  else buildMs(startHH, startMM)
                    val endMs   = if (allDay) startMs + 86_400_000L - 1
                                  else buildMs(endHH, endMM)
                    onAdd(title, startMs, endMs, loc, desc, allDay)
                }
            }) { Text("Add", color = AccentBlue) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } },
    )
}
