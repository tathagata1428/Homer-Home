package ro.b4it.homer.ui.screens.focus

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.screens.home.SmallChip
import ro.b4it.homer.ui.theme.*

@Composable
fun FocusScreen(vm: FocusViewModel = hiltViewModel()) {
    val state    by vm.state.collectAsStateWithLifecycle()
    val settings by vm.settings.collectAsStateWithLifecycle()
    val tasks    by vm.openTasks.collectAsStateWithLifecycle(emptyList())
    val doneTasks by vm.allTasks.collectAsStateWithLifecycle(emptyList())
    val newTask  by vm.newTask.collectAsStateWithLifecycle()
    var showSettings by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(BgPrimary),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Phase pill
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                PhasePill(state.phase, state.cycleCount)
            }
        }

        // Timer ring
        item {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                TimerRing(
                    secsLeft  = state.secsLeft,
                    totalSecs = state.totalSecs,
                    running   = state.running,
                    phase     = state.phase,
                )
            }
        }

        // Controls
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = vm::reset) {
                    Icon(Icons.Filled.Replay, "Reset", tint = TextMuted)
                }
                Spacer(Modifier.width(16.dp))
                Button(
                    onClick = vm::startPause,
                    shape = RoundedCornerShape(50),
                    colors = ButtonDefaults.buttonColors(containerColor = AccentBlue),
                    modifier = Modifier.height(48.dp).width(120.dp),
                ) {
                    Text(if (state.running) "Pause" else "Start", fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(16.dp))
                IconButton(onClick = vm::skip) {
                    Icon(Icons.Filled.SkipNext, "Skip", tint = TextMuted)
                }
            }
        }

        // Settings toggle
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                SmallChip(if (showSettings) "Hide Settings" else "Settings") { showSettings = !showSettings }
            }
        }

        // Settings panel
        if (showSettings) {
            item {
                PomodoroSettingsCard(settings = settings, vm = vm)
            }
        }

        // Task input
        item {
            HomerCard {
                Row(
                    Modifier.fillMaxWidth().padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = newTask,
                        onValueChange = vm::setNewTask,
                        placeholder = { Text("Add a task...", color = TextSubtle) },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AccentBlue,
                            unfocusedBorderColor = BorderDefault,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                        ),
                    )
                    Spacer(Modifier.width(8.dp))
                    IconButton(onClick = vm::addTask) {
                        Icon(Icons.Filled.Add, "Add", tint = AccentBlue)
                    }
                }
            }
        }

        // Open tasks
        if (tasks.isNotEmpty()) {
            item { Text("Tasks", style = MaterialTheme.typography.labelMedium, color = TextMuted) }
            items(tasks) { task ->
                TaskRow(task = task, onToggle = { vm.toggleTask(task) }, onDelete = { vm.deleteTask(task) })
            }
        }

        // Done tasks
        val done = doneTasks.filter { it.done }
        if (done.isNotEmpty()) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Completed (${done.size})", style = MaterialTheme.typography.labelMedium, color = TextMuted)
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = vm::clearDone) { Text("Clear", color = AccentRed, style = MaterialTheme.typography.labelSmall) }
                }
            }
            items(done) { task ->
                TaskRow(task = task, onToggle = { vm.toggleTask(task) }, onDelete = { vm.deleteTask(task) })
            }
        }
    }
}

@Composable
fun TimerRing(secsLeft: Int, totalSecs: Int, running: Boolean, phase: PomodoroPhase) {
    val progress = if (totalSecs > 0) secsLeft.toFloat() / totalSecs.toFloat() else 0f
    val ringColor = when (phase) {
        PomodoroPhase.FOCUS -> AccentBlue
        PomodoroPhase.SHORT -> AccentGreen
        PomodoroPhase.LONG  -> AccentViolet
    }
    val animProg by animateFloatAsState(progress, animationSpec = tween(800), label = "ring")

    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(220.dp)) {
        androidx.compose.foundation.Canvas(modifier = Modifier.size(220.dp)) {
            val stroke = Stroke(width = 12.dp.toPx(), cap = StrokeCap.Round)
            // Background ring
            drawArc(color = Color(0xFF1E293B), startAngle = -90f, sweepAngle = 360f, useCenter = false, style = stroke)
            // Progress ring
            drawArc(color = ringColor, startAngle = -90f, sweepAngle = -360f * (1f - animProg), useCenter = false, style = stroke)
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            val mins = secsLeft / 60
            val secs = secsLeft % 60
            Text("%02d:%02d".format(mins, secs), fontSize = 42.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Text(phase.label, style = MaterialTheme.typography.labelMedium, color = TextMuted)
        }
    }
}

@Composable
fun PhasePill(phase: PomodoroPhase, cycle: Int) {
    val color = when (phase) {
        PomodoroPhase.FOCUS -> AccentBlue
        PomodoroPhase.SHORT -> AccentGreen
        PomodoroPhase.LONG  -> AccentViolet
    }
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.15f)).padding(horizontal = 14.dp, vertical = 6.dp),
    ) {
        Text(phase.label, color = color, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
        Text("${cycle + 1}/4", color = color.copy(alpha = 0.7f), style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
fun TaskRow(task: ro.b4it.homer.data.local.entity.PomodoroTask, onToggle: () -> Unit, onDelete: () -> Unit) {
    HomerCard {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(
                checked = task.done, onCheckedChange = { onToggle() },
                colors = CheckboxDefaults.colors(
                    checkedColor = AccentBlue,
                    uncheckedColor = TextMuted,
                    checkmarkColor = TextPrimary,
                ),
            )
            Text(
                task.text,
                style = MaterialTheme.typography.bodyMedium.copy(
                    textDecoration = if (task.done) TextDecoration.LineThrough else null,
                    color = if (task.done) TextMuted else TextPrimary,
                ),
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Filled.Close, null, tint = TextSubtle, modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
fun PomodoroSettingsCard(settings: PomodoroSettings, vm: FocusViewModel) {
    HomerCard {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Timer Settings", style = MaterialTheme.typography.titleSmall, color = TextMuted)

            DurationSetting("Focus", settings.focusMin, 1..120) { vm.setFocusMin(it) }
            DurationSetting("Short Break", settings.shortMin, 1..30) { vm.setShortMin(it) }
            DurationSetting("Long Break", settings.longMin, 1..60) { vm.setLongMin(it) }

            ToggleSetting("Auto-start phases", settings.autoStart) { vm.setAutoStart(it) }
            ToggleSetting("Notifications", settings.notifications) { vm.setNotifications(it) }
            ToggleSetting("Voice (D'oh!)", settings.voice) { vm.setVoice(it) }
            ToggleSetting("Sound effects", settings.sfx) { vm.setSfx(it) }
        }
    }
}

@Composable
fun DurationSetting(label: String, value: Int, range: IntRange, onChange: (Int) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
        IconButton(onClick = { if (value > range.first) onChange(value - 1) }, Modifier.size(32.dp)) {
            Icon(Icons.Filled.Remove, null, tint = TextMuted, modifier = Modifier.size(16.dp))
        }
        Text("$value min", style = MaterialTheme.typography.bodySmall, color = AccentBlue, modifier = Modifier.widthIn(min = 54.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        IconButton(onClick = { if (value < range.last) onChange(value + 1) }, Modifier.size(32.dp)) {
            Icon(Icons.Filled.Add, null, tint = TextMuted, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
fun ToggleSetting(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
        Switch(
            checked = checked, onCheckedChange = onChange,
            colors = SwitchDefaults.colors(checkedThumbColor = AccentBlue, checkedTrackColor = AccentBlue.copy(alpha = 0.3f)),
        )
    }
}
