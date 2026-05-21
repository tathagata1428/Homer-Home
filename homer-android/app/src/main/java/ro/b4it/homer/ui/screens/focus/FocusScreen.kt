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
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
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
import ro.b4it.homer.ui.theme.*

@Composable
fun FocusScreen(vm: FocusViewModel = hiltViewModel()) {
    val state     by vm.state.collectAsStateWithLifecycle()
    val settings  by vm.settings.collectAsStateWithLifecycle()
    val tasks   by vm.openTasks.collectAsStateWithLifecycle(emptyList())
    val newTask by vm.newTask.collectAsStateWithLifecycle()
    var showSettings by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(BgPrimary).imePadding(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text("Focus", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = TextPrimary, modifier = Modifier.padding(top = 4.dp))
        }

        // ── Timer card ───────────────────────────────────────────────────────
        item {
            HomerCard {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp, horizontal = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(24.dp),
                ) {
                    // Phase pill + cycle dots
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        PhasePill(state.phase)
                        CycleDots(state.phase, state.cycleCount)
                    }

                    // Timer ring
                    TimerRing(
                        secsLeft  = state.secsLeft,
                        totalSecs = state.totalSecs,
                        running   = state.running,
                        phase     = state.phase,
                    )

                    // Controls: Reset | ▶ Play/Pause | Skip
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(24.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        FilledTonalIconButton(
                            onClick = vm::reset,
                            modifier = Modifier.size(48.dp),
                            colors = IconButtonDefaults.filledTonalIconButtonColors(
                                containerColor = BgCardAlt,
                            ),
                        ) {
                            Icon(Icons.Filled.Replay, "Reset", tint = TextMuted, modifier = Modifier.size(20.dp))
                        }

                        Button(
                            onClick = vm::startPause,
                            shape = CircleShape,
                            colors = ButtonDefaults.buttonColors(containerColor = phaseColor(state.phase)),
                            modifier = Modifier.size(68.dp),
                            contentPadding = PaddingValues(0.dp),
                        ) {
                            Icon(
                                if (state.running) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                                contentDescription = if (state.running) "Pause" else "Start",
                                modifier = Modifier.size(30.dp),
                            )
                        }

                        FilledTonalIconButton(
                            onClick = vm::skip,
                            modifier = Modifier.size(48.dp),
                            colors = IconButtonDefaults.filledTonalIconButtonColors(
                                containerColor = Color(0xFF1E293B),
                            ),
                        ) {
                            Icon(Icons.Filled.SkipNext, "Skip", tint = TextMuted, modifier = Modifier.size(20.dp))
                        }
                    }

                    // Mini stats + settings toggle
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Cycle ${state.cycleCount + 1} of 4",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSubtle,
                        )
                        TextButton(
                            onClick = { showSettings = !showSettings },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                        ) {
                            Icon(
                                if (showSettings) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                                null, tint = TextMuted, modifier = Modifier.size(16.dp),
                            )
                            Spacer(Modifier.width(4.dp))
                            Text("Settings", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        }
                    }
                }
            }
        }

        // ── Settings panel (expandable) ──────────────────────────────────────
        if (showSettings) {
            item { PomodoroSettingsCard(settings = settings, vm = vm) }
        }

        // ── Task input ───────────────────────────────────────────────────────
        item {
            HomerCard {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = newTask,
                        onValueChange = vm::setNewTask,
                        placeholder = { Text("Add a focus task…", color = TextSubtle) },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AccentBlue,
                            unfocusedBorderColor = Color(0x1FFFFFFF),
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

        // ── Open tasks ───────────────────────────────────────────────────────
        val openList = tasks
        if (openList.isNotEmpty()) {
            item {
                Row(
                    Modifier.padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("Focus tasks", fontSize = 12.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                    Box(Modifier.weight(1f).height(1.dp).background(BorderSubtle))
                    Text("${openList.size}", fontSize = 11.sp, color = AccentBlue, fontWeight = FontWeight.SemiBold)
                    Box(
                        Modifier.clip(RoundedCornerShape(6.dp))
                            .background(AccentRed.copy(0.08f))
                            .border(1.dp, AccentRed.copy(0.35f), RoundedCornerShape(6.dp))
                            .clickable { vm.clearAllTasks() }
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                    ) {
                        Text("CLEAR ALL", fontSize = 7.sp, letterSpacing = 0.8.sp, color = AccentRed.copy(0.85f), fontWeight = FontWeight.Bold)
                    }
                }
            }
            items(openList) { task ->
                // Tap checkbox = done = task is deleted immediately (clears from In Focus on Home too)
                TaskRow(task, onToggle = { vm.toggleTask(task) }, onDelete = { vm.deleteTask(task) })
            }
        }

        // ── Tips card (mirrors website) ──────────────────────────────────────
        item {
            HomerCard {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Tips", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    val tips = listOf(
                        "25/5 is classic — 25 min focus, 5 min short break, long break every 4th cycle.",
                        "Add one task per focus block before you start — it keeps you locked in.",
                        "Enable Notifications to get alerted when a phase ends.",
                        "Enable Auto-start so breaks and focus sessions begin automatically.",
                    )
                    tips.forEach { tip ->
                        Text(
                            "• $tip",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextMuted,
                            lineHeight = 18.sp,
                        )
                    }
                }
            }
        }

        item { Spacer(Modifier.height(8.dp)) }
    }
}

// ── Timer Ring ────────────────────────────────────────────────────────────────

@Composable
fun TimerRing(secsLeft: Int, totalSecs: Int, running: Boolean, phase: PomodoroPhase) {
    val progress   = if (totalSecs > 0) secsLeft.toFloat() / totalSecs.toFloat() else 0f
    val color      = phaseColor(phase)
    val animProg   by animateFloatAsState(progress, animationSpec = tween(800), label = "ring")
    val glowAlpha  by animateFloatAsState(if (running) 1f else 0.3f, tween(600), label = "glow")

    val pulseScale by rememberInfiniteTransition(label = "pulse").animateFloat(
        initialValue  = 1.00f,
        targetValue   = if (running) 1.035f else 1.00f,
        animationSpec = infiniteRepeatable(tween(2000, easing = EaseInOutSine), RepeatMode.Reverse),
        label         = "pulseScale",
    )

    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(270.dp)) {
        // Outer ambient glow (large soft halo)
        androidx.compose.foundation.Canvas(modifier = Modifier.size(270.dp)) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        color.copy(alpha = 0.30f * glowAlpha),
                        color.copy(alpha = 0.10f * glowAlpha),
                        Color.Transparent,
                    ),
                    radius = size.minDimension / 2f,
                    center = center,
                ),
            )
        }
        // Ring canvas
        androidx.compose.foundation.Canvas(
            modifier = Modifier.size(220.dp).scale(pulseScale),
        ) {
            val strokePx = 18.dp.toPx()
            val sweepAngle = -360f * (1f - animProg)

            // Track (soft warm arc)
            drawArc(
                color     = Color(0x22000000),
                startAngle = -90f, sweepAngle = 360f,
                useCenter = false, style = Stroke(strokePx, cap = StrokeCap.Round),
            )

            if (animProg > 0f) {
                // Glow layer — layered semi-transparent arcs simulate blur glow
                for (i in 4 downTo 1) {
                    drawArc(
                        color      = color.copy(alpha = 0.07f * i * glowAlpha),
                        startAngle = -90f, sweepAngle = sweepAngle,
                        useCenter  = false,
                        style      = Stroke(strokePx + strokePx * 0.55f * i, cap = StrokeCap.Round),
                    )
                }
                // Progress arc (crisp, on top)
                drawArc(
                    color     = color,
                    startAngle = -90f, sweepAngle = sweepAngle,
                    useCenter = false, style = Stroke(strokePx, cap = StrokeCap.Round),
                )
                // Bright dot centered exactly on the arc tip
                val angleRad = Math.toRadians((-90f + sweepAngle).toDouble())
                val r = size.minDimension / 2f
                val dotCenter = androidx.compose.ui.geometry.Offset(
                    x = center.x + (r * Math.cos(angleRad)).toFloat(),
                    y = center.y + (r * Math.sin(angleRad)).toFloat(),
                )
                // Glow halo rings around dot (matches arc glow bloom)
                for (i in 3 downTo 1) {
                    drawCircle(
                        color  = color.copy(alpha = 0.09f * i * glowAlpha),
                        radius = strokePx / 2f + strokePx * 0.35f * i,
                        center = dotCenter,
                    )
                }
                // Bright dot at arc tip
                drawCircle(
                    color  = Color(0xFFFEFCF8).copy(alpha = 0.95f * glowAlpha),
                    radius = strokePx / 2f,
                    center = dotCenter,
                )
            }
        }
        // Time + label
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            val mins = secsLeft / 60
            val secs = secsLeft % 60
            Text(
                "%02d:%02d".format(mins, secs),
                fontSize      = 56.sp,
                fontWeight    = FontWeight.Bold,
                color         = TextPrimary,
                letterSpacing = (-2).sp,
            )
            Text(phase.label, style = MaterialTheme.typography.labelMedium, color = color)
        }
    }
}

// ── Phase pill ────────────────────────────────────────────────────────────────

@Composable
fun PhasePill(phase: PomodoroPhase) {
    val color = phaseColor(phase)
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(color.copy(alpha = 0.15f))
            .border(1.dp, color.copy(alpha = 0.35f), RoundedCornerShape(50))
            .padding(horizontal = 14.dp, vertical = 6.dp),
    ) {
        Text(phase.label, color = color, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
    }
}

// ── Cycle dots ────────────────────────────────────────────────────────────────

@Composable
fun CycleDots(phase: PomodoroPhase, cycleCount: Int) {
    val color = phaseColor(phase)
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(4) { i ->
            val isCompleted = i < cycleCount
            val isActive    = (i == cycleCount) && phase == PomodoroPhase.FOCUS
            Box(
                Modifier
                    .size(if (isActive) 9.dp else 7.dp)
                    .clip(CircleShape)
                    .background(when {
                        isActive    -> color
                        isCompleted -> color.copy(alpha = 0.45f)
                        else        -> Color(0xFF1E293B)
                    }),
            )
        }
    }
}

// ── Task row ──────────────────────────────────────────────────────────────────

@Composable
fun TaskRow(
    task: ro.b4it.homer.data.local.entity.PomodoroTask,
    onToggle: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(BgCard)
            .border(1.dp, BorderDefault, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // Tap-to-complete circle
        Box(
            Modifier.size(26.dp).clip(CircleShape)
                .background(AccentGreen.copy(0.08f))
                .border(1.5.dp, AccentGreen.copy(0.35f), CircleShape)
                .clickable(onClick = onToggle),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Check, null, tint = AccentGreen.copy(0.6f), modifier = Modifier.size(14.dp))
        }
        Text(
            task.text,
            style = MaterialTheme.typography.bodyMedium,
            color = TextPrimary,
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
            Icon(Icons.Filled.Close, null, tint = TextSubtle.copy(0.5f), modifier = Modifier.size(14.dp))
        }
    }
}

// ── Settings card ─────────────────────────────────────────────────────────────

@Composable
fun PomodoroSettingsCard(settings: PomodoroSettings, vm: FocusViewModel) {
    HomerCard {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Timer Settings", style = MaterialTheme.typography.titleSmall, color = TextMuted)
            DurationSetting("Focus",       settings.focusMin, 1..120) { vm.setFocusMin(it) }
            DurationSetting("Short Break", settings.shortMin, 1..30)  { vm.setShortMin(it) }
            DurationSetting("Long Break",  settings.longMin,  1..60)  { vm.setLongMin(it)  }
            HorizontalDivider(color = Color(0x1AFFFFFF))
            ToggleSetting("Auto-start phases",   settings.autoStart)     { vm.setAutoStart(it)     }
            ToggleSetting("Notifications",       settings.notifications) { vm.setNotifications(it) }
            ToggleSetting("Sound effects (SFX)", settings.sfx)          { vm.setSfx(it)           }
            ToggleSetting("Homer voice (D'oh!)", settings.voice)         { vm.setVoice(it)         }
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
        Text(
            "$value min",
            style    = MaterialTheme.typography.bodySmall,
            color    = AccentBlue,
            modifier = Modifier.widthIn(min = 52.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
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
            colors = SwitchDefaults.colors(
                checkedThumbColor = AccentBlue,
                checkedTrackColor = AccentBlue.copy(alpha = 0.3f),
            ),
        )
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

@Composable
fun phaseColor(phase: PomodoroPhase) = when (phase) {
    PomodoroPhase.FOCUS -> AccentBlue
    PomodoroPhase.SHORT -> AccentGreen
    PomodoroPhase.LONG  -> AccentViolet
}
