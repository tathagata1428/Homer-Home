package ro.b4it.homer.ui.screens.countdown

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
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
    val eventName   by vm.eventName.collectAsStateWithLifecycle()
    val eventDateMs by vm.eventDateMs.collectAsStateWithLifecycle()
    val quote       by vm.quote.collectAsStateWithLifecycle()
    val loading     by vm.loading.collectAsStateWithLifecycle()

    var showSetup by remember(eventDateMs == 0L) { mutableStateOf(eventDateMs == 0L) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgPrimary)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // ── Header ────────────────────────────────────────────────────
        Column(
            modifier = Modifier.padding(start = 24.dp, end = 24.dp, top = 20.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                "Countdown",
                fontSize = 26.sp, fontWeight = FontWeight.ExtraBold,
                letterSpacing = 0.sp, color = TextPrimary,
            )
            Box(
                Modifier.width(48.dp).height(2.dp)
                    .background(Brush.horizontalGradient(listOf(NeonPink, NeonCyan)))
            )
        }

        // ── Event card ────────────────────────────────────────────────
        HomerCard(modifier = Modifier.padding(horizontal = 16.dp)) {
            Column(
                Modifier.fillMaxWidth().padding(20.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment     = Alignment.CenterVertically,
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(
                            "Event",
                            fontSize = 10.sp, fontWeight = FontWeight.Bold,
                            letterSpacing = 0.sp, color = TextMuted,
                        )
                        Text(
                            if (eventDateMs > 0L) eventName.ifBlank { "Unnamed Event" }
                            else "No event set",
                            fontWeight = FontWeight.SemiBold, fontSize = 15.sp,
                            color = TextPrimary,
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (eventDateMs > 0L) {
                            FilledTonalIconButton(
                                onClick = { vm.clearEvent(); showSetup = false },
                                colors  = IconButtonDefaults.filledTonalIconButtonColors(
                                    containerColor = NeonPink.copy(0.10f),
                                    contentColor   = NeonPink,
                                ),
                                modifier = Modifier.size(36.dp),
                            ) {
                                Icon(Icons.Filled.Close, null, modifier = Modifier.size(16.dp))
                            }
                        }
                        FilledTonalIconButton(
                            onClick = { showSetup = !showSetup },
                            colors  = IconButtonDefaults.filledTonalIconButtonColors(
                                containerColor = if (showSetup) AccentBlue.copy(0.10f) else BgCardAlt,
                                contentColor   = if (showSetup) NeonPink else TextMuted,
                            ),
                            modifier = Modifier.size(36.dp),
                        ) {
                            Icon(Icons.Filled.Edit, null, modifier = Modifier.size(16.dp))
                        }
                    }
                }

                // Date badge
                AnimatedVisibility(
                    visible = eventDateMs > 0L && !showSetup,
                    enter   = fadeIn(tween(200)) + expandVertically(tween(220)),
                    exit    = fadeOut(tween(150)) + shrinkVertically(tween(180)),
                ) {
                    val fmt = remember { SimpleDateFormat("EEE, d MMM yyyy  ·  HH:mm", Locale.getDefault()) }
                    Row(
                        modifier = Modifier.padding(top = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(
                            Icons.Filled.DateRange, null,
                            tint = NeonCyan.copy(0.5f), modifier = Modifier.size(13.dp),
                        )
                        Text(fmt.format(Date(eventDateMs)), fontSize = 12.sp, color = TextMuted)
                    }
                }

                // Setup form
                AnimatedVisibility(
                    visible = showSetup,
                    enter   = fadeIn(tween(250)) + expandVertically(tween(300, easing = FastOutSlowInEasing)),
                    exit    = fadeOut(tween(180)) + shrinkVertically(tween(220, easing = FastOutSlowInEasing)),
                ) {
                    Column(modifier = Modifier.padding(top = 18.dp)) {
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
        }

        // ── Countdown numbers ─────────────────────────────────────────
        AnimatedVisibility(
            visible  = tick.hasEvent,
            enter    = fadeIn(tween(400)) +
                       slideInVertically(tween(420, easing = FastOutSlowInEasing)) { it / 3 },
            exit     = fadeOut(tween(200)),
            modifier = Modifier.padding(horizontal = 16.dp),
        ) {
            HomerCard {
                Column(
                    Modifier.fillMaxWidth().padding(vertical = 36.dp, horizontal = 20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    if (tick.isPast) {
                        Text("🎉", fontSize = 42.sp, textAlign = TextAlign.Center)
                        Text(
                            "This event has already passed",
                            fontSize = 16.sp, fontWeight = FontWeight.SemiBold,
                            color = NeonPink, textAlign = TextAlign.Center,
                        )
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment     = Alignment.Bottom,
                        ) {
                            CountUnit(tick.days,  "days", NeonPink,   largeWhenBig = true)
                            SepColon()
                            CountUnit(tick.hours, "hrs",  NeonCyan)
                            SepColon()
                            CountUnit(tick.mins,  "min",  NeonPurple)
                            SepColon()
                            CountUnit(tick.secs,  "sec",  NeonGold)
                        }
                        Text(
                            "until ${eventName.ifBlank { "the event" }}",
                            fontSize = 12.sp, color = TextSubtle,
                            textAlign = TextAlign.Center, letterSpacing = 0.3.sp,
                        )
                    }
                }
            }
        }

        // ── Quote ─────────────────────────────────────────────────────
        AnimatedVisibility(
            visible  = tick.hasEvent,
            enter    = fadeIn(tween(500, delayMillis = 100)) +
                       slideInVertically(tween(500, delayMillis = 100, easing = FastOutSlowInEasing)) { it / 3 },
            exit     = fadeOut(tween(200)),
            modifier = Modifier.padding(horizontal = 16.dp),
        ) {
            HomerCard {
                Column(
                    Modifier.fillMaxWidth().padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Quote",
                            fontSize = 10.sp, fontWeight = FontWeight.Bold,
                            letterSpacing = 0.sp, color = TextMuted,
                        )
                        IconButton(
                            onClick = { vm.refreshQuote() },
                            enabled = !loading,
                            modifier = Modifier.size(28.dp),
                        ) {
                            Icon(
                                Icons.Filled.Refresh, null,
                                tint = if (loading) TextSubtle else NeonPurple.copy(0.7f),
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(BgCardAlt)
                            .border(1.dp, BorderDefault, RoundedCornerShape(12.dp))
                            .padding(16.dp),
                        contentAlignment = Alignment.TopStart,
                    ) {
                        when {
                            loading -> {
                                val pulse by rememberInfiniteTransition(label = "pulse")
                                    .animateFloat(
                                        0.25f, 0.88f,
                                        infiniteRepeatable(tween(900), RepeatMode.Reverse),
                                        label = "p",
                                    )
                                Text(
                                    "Loading quote\u2026",
                                    fontSize = 14.sp,
                                    color = NeonPurple.copy(pulse),
                                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                                )
                            }
                            quote.isBlank() -> Text(
                                "Tap \u21bb to load a quote.",
                                fontSize = 13.sp,
                                color = TextSubtle.copy(0.55f),
                                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                            )
                            else -> AnimatedContent(
                                targetState = quote,
                                transitionSpec = { fadeIn(tween(350)) togetherWith fadeOut(tween(200)) },
                                label = "quote",
                            ) { text ->
                                Text(
                                    text,
                                    fontSize = 14.sp, lineHeight = 22.sp,
                                    color = TextPrimary.copy(0.82f),
                                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                                )
                            }
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(8.dp))
        Spacer(Modifier.navigationBarsPadding())
    }
}

// ── Count unit with flip animation ────────────────────────────────────────────

@Composable
private fun CountUnit(value: Long, label: String, color: Color, largeWhenBig: Boolean = false) {
    val padded = if (largeWhenBig && value >= 100) value.toString().padStart(3, '0')
                 else value.toString().padStart(2, '0')
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(horizontal = 5.dp),
    ) {
        AnimatedContent(
            targetState = padded,
            transitionSpec = {
                (slideInVertically(tween(220, easing = FastOutSlowInEasing)) { it } + fadeIn(tween(180)))
                    .togetherWith(slideOutVertically(tween(180)) { -it } + fadeOut(tween(150)))
            },
            label = "count_$label",
        ) { str ->
            Text(
                text          = str,
                fontFamily    = FontFamily.Monospace,
                fontSize      = 40.sp,
                fontWeight    = FontWeight.Black,
                color         = color,
                letterSpacing = (-1.5).sp,
            )
        }
        Text(
            label,
            fontSize = 9.sp, fontWeight = FontWeight.Bold,
            letterSpacing = 0.sp, color = TextSubtle,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

@Composable
private fun SepColon() {
    Text(
        ":",
        fontSize = 24.sp, fontWeight = FontWeight.Light,
        color = TextSubtle,
        modifier = Modifier.offset(y = (-10).dp),
    )
}

// ── Event setup form ──────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EventSetupForm(
    initialName:   String,
    initialDateMs: Long,
    onSet: (name: String, dateMs: Long) -> Unit,
) {
    var name       by remember { mutableStateOf(initialName) }
    var pickedDate by remember {
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

    val datePickerState = rememberDatePickerState(initialSelectedDateMillis = pickedDate.timeInMillis)
    val timePickerState = rememberTimePickerState(
        initialHour   = pickedDate.get(Calendar.HOUR_OF_DAY),
        initialMinute = pickedDate.get(Calendar.MINUTE),
    )
    val dateFmt = remember { SimpleDateFormat("EEE, d MMM yyyy  ·  HH:mm", Locale.getDefault()) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
            value         = name,
            onValueChange = { name = it },
            label         = { Text("Event name") },
            modifier      = Modifier.fillMaxWidth(),
            singleLine    = true,
            colors        = OutlinedTextFieldDefaults.colors(
                focusedBorderColor   = AccentBlue,
                unfocusedBorderColor = BorderDefault,
                focusedLabelColor    = AccentBlue,
                unfocusedLabelColor  = TextMuted,
                focusedTextColor     = TextPrimary,
                unfocusedTextColor   = TextPrimary,
                cursorColor          = AccentBlue,
            ),
        )

        OutlinedTextField(
            value         = dateFmt.format(pickedDate.time),
            onValueChange = {},
            readOnly      = true,
            label         = { Text("Date & Time") },
            trailingIcon  = {
                IconButton(onClick = { showDatePicker = true }) {
                    Icon(Icons.Filled.DateRange, null, tint = NeonCyan, modifier = Modifier.size(18.dp))
                }
            },
            modifier = Modifier.fillMaxWidth().clickable { showDatePicker = true },
            colors   = OutlinedTextFieldDefaults.colors(
                focusedBorderColor   = AccentBlue,
                unfocusedBorderColor = BorderDefault,
                focusedLabelColor    = AccentBlue,
                unfocusedLabelColor  = TextMuted,
                focusedTextColor     = TextPrimary,
                unfocusedTextColor   = TextPrimary,
            ),
        )

        Button(
            onClick  = { if (pickedDate.timeInMillis > 0) onSet(name.trim(), pickedDate.timeInMillis) },
            shape    = RoundedCornerShape(10.dp),
            colors   = ButtonDefaults.buttonColors(
                containerColor = Color.Transparent,
                contentColor   = AccentBlue,
            ),
            border   = BorderStroke(1.dp, BorderDefault),
            modifier = Modifier.fillMaxWidth().height(46.dp),
        ) {
            Text("Save Event", fontWeight = FontWeight.Bold, fontSize = 14.sp)
        }
    }

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
        ) { DatePicker(state = datePickerState) }
    }

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
