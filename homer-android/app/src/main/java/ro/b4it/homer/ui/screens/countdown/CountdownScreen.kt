package ro.b4it.homer.ui.screens.countdown

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CountdownScreen(vm: CountdownViewModel = hiltViewModel()) {
    val tick        by vm.tick.collectAsStateWithLifecycle()
    val mode        by vm.mode.collectAsStateWithLifecycle()
    val eventName   by vm.eventName.collectAsStateWithLifecycle()
    val eventDateMs by vm.eventDateMs.collectAsStateWithLifecycle()
    val commentary  by vm.commentary.collectAsStateWithLifecycle()
    val loading     by vm.loading.collectAsStateWithLifecycle()

    var showSetup   by remember { mutableStateOf(eventDateMs == 0L) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgPrimary)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // ── Screen header ────────────────────────────────────────────
        Column(
            modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                "COUNTDOWN",
                fontSize = 28.sp, fontWeight = FontWeight.ExtraBold,
                letterSpacing = 4.sp, color = TextPrimary,
            )
            Box(
                Modifier.width(64.dp).height(2.dp)
                    .background(Brush.horizontalGradient(listOf(NeonPink, NeonCyan)))
            )
        }

        // ── Setup card (collapsed when event is set) ─────────────────
        HomerCard {
            Column(
                Modifier.fillMaxWidth().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        if (eventDateMs > 0) eventName.ifBlank { "Event" } else "Set an Event",
                        fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary,
                    )
                    IconButton(onClick = { showSetup = !showSetup }) {
                        Icon(
                            Icons.Filled.Edit, "Edit event",
                            tint = if (showSetup) NeonPink else TextMuted,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }

                if (eventDateMs > 0 && !showSetup) {
                    val fmt = remember { SimpleDateFormat("EEE, d MMM yyyy  HH:mm", Locale.getDefault()) }
                    Text(
                        fmt.format(Date(eventDateMs)),
                        fontSize = 13.sp, color = TextMuted,
                    )
                }

                if (showSetup) {
                    EventSetupForm(
                        initialName   = eventName,
                        initialDateMs = eventDateMs,
                        onSet         = { name, dateMs ->
                            vm.setEvent(name, dateMs)
                            showSetup = false
                        },
                    )
                }
            }
        }

        // ── Countdown display ────────────────────────────────────────
        if (tick.hasEvent) {
            HomerCard {
                Column(
                    Modifier.fillMaxWidth().padding(vertical = 28.dp, horizontal = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    if (tick.isPast) {
                        Text(
                            "\uD83C\uDF89 This event has already passed!",
                            fontSize = 18.sp, fontWeight = FontWeight.Bold,
                            color = NeonPink, textAlign = TextAlign.Center,
                        )
                    } else {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            CountUnit(tick.days,  "DAYS",  NeonPink,   largeWhenBig = true)
                            Separator()
                            CountUnit(tick.hours, "HRS",   NeonCyan)
                            Separator()
                            CountUnit(tick.mins,  "MIN",   NeonPurple)
                            Separator()
                            CountUnit(tick.secs,  "SEC",   NeonGold)
                        }
                        Text(
                            "until ${eventName.ifBlank { "the event" }}",
                            fontSize = 13.sp, color = TextMuted,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }

        // ── Mode selector + commentary ────────────────────────────────
        if (tick.hasEvent) {
            HomerCard {
                Column(
                    Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Text(
                        "COMMENTARY",
                        fontSize = 11.sp, fontWeight = FontWeight.Bold,
                        letterSpacing = 3.sp, color = TextMuted,
                    )

                    // Mode chips
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier
                            .horizontalScroll(rememberScrollState())
                            .fillMaxWidth(),
                    ) {
                        CommentaryMode.entries.forEach { m ->
                            val selected = m == mode
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(if (selected) NeonPink.copy(0.14f) else Color.Transparent)
                                    .border(
                                        1.dp,
                                        if (selected) NeonPink.copy(0.55f) else BorderDefault,
                                        RoundedCornerShape(20.dp),
                                    )
                                    .clickable { vm.setMode(m) }
                                    .padding(horizontal = 14.dp, vertical = 8.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    "${m.emoji} ${m.label}",
                                    fontSize = 13.sp,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (selected) NeonPink else TextMuted,
                                )
                            }
                        }
                    }

                    // Commentary box
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(BgCardAlt)
                            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
                            .padding(16.dp),
                    ) {
                        if (loading) {
                            val alpha by rememberInfiniteTransition(label = "pulse")
                                .animateFloat(
                                    0.3f, 1f,
                                    infiniteRepeatable(tween(800), RepeatMode.Reverse),
                                    label = "a",
                                )
                            Text(
                                "Joey is thinking\u2026",
                                fontSize = 14.sp, color = NeonPurple.copy(alpha),
                                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                            )
                        } else if (commentary.isBlank()) {
                            Text(
                                "Tap \u201CNew Commentary\u201D to let Joey weigh in.",
                                fontSize = 14.sp, color = TextSubtle,
                                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                            )
                        } else {
                            Text(
                                commentary,
                                fontSize = 15.sp,
                                lineHeight = 24.sp,
                                color = Color(0xFFD0D0F0),
                                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                            )
                        }
                    }

                    Button(
                        onClick  = { vm.generateCommentary() },
                        enabled  = !loading,
                        shape    = RoundedCornerShape(10.dp),
                        colors   = ButtonDefaults.buttonColors(
                            containerColor = NeonPurple.copy(0.15f),
                            contentColor   = NeonPurple,
                            disabledContainerColor = NeonPurple.copy(0.05f),
                            disabledContentColor   = NeonPurple.copy(0.3f),
                        ),
                        border   = BorderStroke(1.dp, NeonPurple.copy(if (loading) 0.15f else 0.35f)),
                        modifier = Modifier.fillMaxWidth().height(44.dp),
                    ) {
                        Icon(Icons.Filled.AutoAwesome, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("New Commentary", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                }
            }
        }

        Spacer(Modifier.navigationBarsPadding())
    }
}

@Composable
private fun CountUnit(value: Long, label: String, color: Color, largeWhenBig: Boolean = false) {
    val numStr = if (largeWhenBig && value >= 100) value.toString().padStart(3, '0')
                 else value.toString().padStart(2, '0')
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White.copy(alpha = 0.03f))
            .border(1.dp, Color.White.copy(alpha = 0.07f), RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 14.dp),
    ) {
        Text(
            text = numStr,
            style = TextStyle(
                fontFamily    = FontFamily.Monospace,
                fontSize      = 44.sp,
                fontWeight    = FontWeight.Black,
                color         = color,
                letterSpacing = (-2).sp,
                shadow        = Shadow(color = color.copy(alpha = 0.7f), blurRadius = 24f),
            ),
            lineHeight = 44.sp,
        )
        Text(
            label,
            fontSize = 9.sp, fontWeight = FontWeight.Bold,
            letterSpacing = 3.sp, color = TextSubtle,
            modifier = Modifier.padding(top = 6.dp),
        )
    }
}

@Composable
private fun Separator() {
    Text(
        ":",
        fontSize = 36.sp, fontWeight = FontWeight.Black,
        color = Color.White.copy(alpha = 0.18f),
        modifier = Modifier.offset(y = (-8).dp),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EventSetupForm(
    initialName:   String,
    initialDateMs: Long,
    onSet: (name: String, dateMs: Long) -> Unit,
) {
    var name        by remember { mutableStateOf(initialName) }
    var pickedDate  by remember {
        mutableStateOf(
            if (initialDateMs > 0L) Calendar.getInstance().also { it.timeInMillis = initialDateMs }
            else Calendar.getInstance().also {
                it.add(Calendar.DAY_OF_YEAR, 30)
                it.set(Calendar.HOUR_OF_DAY, 12)
                it.set(Calendar.MINUTE, 0)
            }
        )
    }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    val datePickerState = rememberDatePickerState(
        initialSelectedDateMillis = pickedDate.timeInMillis
    )
    val timePickerState = rememberTimePickerState(
        initialHour   = pickedDate.get(Calendar.HOUR_OF_DAY),
        initialMinute = pickedDate.get(Calendar.MINUTE),
    )

    val dateFmt = remember { SimpleDateFormat("EEE, d MMM yyyy  HH:mm", Locale.getDefault()) }

    OutlinedTextField(
        value         = name,
        onValueChange = { name = it },
        label         = { Text("Event name") },
        modifier      = Modifier.fillMaxWidth(),
        singleLine    = true,
        colors        = OutlinedTextFieldDefaults.colors(
            focusedBorderColor   = NeonPink,
            unfocusedBorderColor = BorderDefault,
            focusedLabelColor    = NeonPink,
            unfocusedLabelColor  = TextMuted,
            focusedTextColor     = TextPrimary,
            unfocusedTextColor   = TextPrimary,
        ),
    )

    OutlinedTextField(
        value         = dateFmt.format(pickedDate.time),
        onValueChange = {},
        readOnly      = true,
        label         = { Text("Date & Time") },
        trailingIcon  = {
            IconButton(onClick = { showDatePicker = true }) {
                Icon(Icons.Filled.Edit, "Pick date", tint = NeonCyan, modifier = Modifier.size(18.dp))
            }
        },
        modifier      = Modifier.fillMaxWidth().clickable { showDatePicker = true },
        colors        = OutlinedTextFieldDefaults.colors(
            focusedBorderColor   = NeonCyan,
            unfocusedBorderColor = BorderDefault,
            focusedLabelColor    = NeonCyan,
            unfocusedLabelColor  = TextMuted,
            focusedTextColor     = TextPrimary,
            unfocusedTextColor   = TextPrimary,
        ),
    )

    Button(
        onClick = {
            val ms = pickedDate.timeInMillis
            if (ms > 0) onSet(name.trim(), ms)
        },
        shape  = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.buttonColors(containerColor = NeonPink.copy(0.15f), contentColor = NeonPink),
        border = BorderStroke(1.dp, NeonPink.copy(0.4f)),
        modifier = Modifier.fillMaxWidth().height(44.dp),
    ) {
        Text("Save Event", fontWeight = FontWeight.Bold)
    }

    // Date picker dialog
    if (showDatePicker) {
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { ms ->
                        pickedDate = Calendar.getInstance().also { cal ->
                            cal.timeInMillis = ms
                            cal.set(Calendar.HOUR_OF_DAY, pickedDate.get(Calendar.HOUR_OF_DAY))
                            cal.set(Calendar.MINUTE, pickedDate.get(Calendar.MINUTE))
                        }
                    }
                    showDatePicker = false
                    showTimePicker = true
                }) { Text("Next", color = NeonCyan) }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel", color = TextMuted) }
            },
        ) {
            DatePicker(state = datePickerState)
        }
    }

    // Time picker dialog
    if (showTimePicker) {
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title    = { Text("Pick Time", color = TextPrimary) },
            text     = { TimePicker(state = timePickerState) },
            confirmButton = {
                TextButton(onClick = {
                    pickedDate = Calendar.getInstance().also { cal ->
                        cal.timeInMillis = pickedDate.timeInMillis
                        cal.set(Calendar.HOUR_OF_DAY, timePickerState.hour)
                        cal.set(Calendar.MINUTE,      timePickerState.minute)
                        cal.set(Calendar.SECOND, 0)
                    }
                    showTimePicker = false
                }) { Text("OK", color = NeonCyan) }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("Cancel", color = TextMuted) }
            },
            containerColor = BgCard,
        )
    }
}
