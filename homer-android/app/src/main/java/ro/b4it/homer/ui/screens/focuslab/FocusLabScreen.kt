package ro.b4it.homer.ui.screens.focuslab

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.theme.*

@Composable
fun FocusLabScreen(vm: FocusLabViewModel = hiltViewModel()) {
    val brainDump by vm.brainDump.collectAsStateWithLifecycle("")
    val zenGoal   by vm.zenGoal.collectAsStateWithLifecycle("")
    var zenMode   by remember { mutableStateOf(false) }
    var focusDot  by remember { mutableStateOf(false) }
    var breathing by remember { mutableStateOf(false) }

    if (zenMode) {
        ZenModeOverlay(goal = zenGoal, onExit = { zenMode = false })
        return
    }
    if (focusDot) {
        FocusDotOverlay(onExit = { focusDot = false })
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgPrimary)
            .verticalScroll(rememberScrollState())
            .imePadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // ── Header ────────────────────────────────────────────────────────
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("FOCUS", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 4.sp, color = TextPrimary)
            Text("LAB", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 4.sp, color = NeonCyan)
            Box(Modifier.width(54.dp).height(2.dp).background(Brush.horizontalGradient(listOf(NeonCyan, NeonPurple))))
            Text(
                "Science-backed tools to prime your brain for deep work",
                fontSize = 12.sp, color = TextMuted, lineHeight = 16.sp,
            )
        }

        // ── Box Breathing ─────────────────────────────────────────────────
        LabCard(
            emoji    = "🫁",
            title    = "Box Breathing",
            subtitle = "4-4-4-4 stress reset",
            why      = "Activates your parasympathetic nervous system in 90 seconds. Used by Navy SEALs to perform under pressure. Reduces cortisol and sharpens focus before a deep work session.",
            accent   = NeonCyan,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                BreathingCircle(active = breathing)
                Box(
                    Modifier.clip(RoundedCornerShape(12.dp))
                        .background(if (breathing) NeonPink.copy(0.1f) else NeonCyan.copy(0.1f))
                        .border(
                            1.5.dp,
                            if (breathing) NeonPink.copy(0.7f) else NeonCyan.copy(0.7f),
                            RoundedCornerShape(12.dp),
                        )
                        .clickable { breathing = !breathing }
                        .padding(horizontal = 32.dp, vertical = 12.dp),
                ) {
                    Text(
                        if (breathing) "⏹  STOP" else "▶  START BREATHING",
                        fontSize = 12.sp,
                        letterSpacing = 1.5.sp,
                        color = if (breathing) NeonPink else NeonCyan,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }
            }
        }

        // ── Focus Dot ─────────────────────────────────────────────────────
        LabCard(
            emoji    = "👁️",
            title    = "Focus Dot",
            subtitle = "Trataka — 30 second gaze exercise",
            why      = "Ancient yogic concentration technique. 30 seconds of fixed gaze activates your prefrontal cortex, calms mental chatter, and switches your brain into single-point attention mode.",
            accent   = NeonPurple,
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                Box(
                    Modifier.clip(RoundedCornerShape(12.dp))
                        .background(NeonPurple.copy(0.1f))
                        .border(1.5.dp, NeonPurple.copy(0.7f), RoundedCornerShape(12.dp))
                        .clickable { focusDot = true }
                        .padding(horizontal = 32.dp, vertical = 12.dp),
                ) {
                    Text(
                        "▶  ENTER FOCUS DOT",
                        fontSize = 12.sp, letterSpacing = 1.5.sp,
                        color = NeonPurple, fontWeight = FontWeight.ExtraBold,
                    )
                }
            }
        }

        // ── Zen Mode ──────────────────────────────────────────────────────
        LabCard(
            emoji    = "🧘",
            title    = "Zen Mode",
            subtitle = "Single-goal immersion",
            why      = "The brain struggles to focus when holding multiple goals. Writing your ONE goal and entering a distraction-free view commits it to working memory and eliminates decision fatigue for the next session.",
            accent   = NeonPink,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = zenGoal,
                    onValueChange = vm::setZenGoal,
                    placeholder = { Text("What is your ONE goal for this session?", color = TextSubtle, fontSize = 13.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor   = NeonPink,
                        unfocusedBorderColor = NeonPink.copy(0.3f),
                        focusedTextColor     = TextPrimary,
                        unfocusedTextColor   = TextPrimary,
                        cursorColor          = NeonPink,
                    ),
                )
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Box(
                        Modifier.clip(RoundedCornerShape(12.dp))
                            .background(Brush.linearGradient(listOf(NeonPink, NeonPurple)))
                            .clickable { if (zenGoal.isNotBlank()) zenMode = true }
                            .padding(horizontal = 24.dp, vertical = 11.dp),
                    ) {
                        Text(
                            "ENTER ZEN MODE",
                            fontSize = 11.sp, letterSpacing = 1.5.sp,
                            color = Color.White, fontWeight = FontWeight.ExtraBold,
                        )
                    }
                }
            }
        }

        // ── Brain Dump ────────────────────────────────────────────────────
        LabCard(
            emoji    = "🧠",
            title    = "Brain Dump",
            subtitle = "Clear your mental RAM",
            why      = "You can only hold 4–7 items in working memory. Externalizing everything on your mind onto paper frees up cognitive bandwidth so your brain can focus on ONE thing deeply instead of juggling tabs.",
            accent   = NeonGold,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = brainDump,
                    onValueChange = vm::setBrainDump,
                    placeholder = { Text("Dump everything on your mind here — tasks, worries, ideas, anything…", color = TextSubtle, fontSize = 13.sp, lineHeight = 18.sp) },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 140.dp),
                    maxLines = 30,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor   = NeonGold,
                        unfocusedBorderColor = NeonGold.copy(0.3f),
                        focusedTextColor     = TextPrimary,
                        unfocusedTextColor   = TextPrimary,
                        cursorColor          = NeonGold,
                    ),
                )
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "${brainDump.split("\\s+".toRegex()).filter { it.isNotBlank() }.size} words",
                        fontSize = 10.sp, color = NeonGold.copy(0.6f), fontWeight = FontWeight.SemiBold,
                    )
                    Text("AUTO-SAVED", fontSize = 8.sp, letterSpacing = 1.sp, color = TextSubtle, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(Modifier.height(8.dp))
    }
}

// ── Lab Card ──────────────────────────────────────────────────────────────────

@Composable
private fun LabCard(
    emoji: String,
    title: String,
    subtitle: String,
    why: String,
    accent: Color,
    content: @Composable () -> Unit,
) {
    var showWhy by remember { mutableStateOf(false) }

    Box(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(BgCard)
            .border(
                1.dp,
                Brush.linearGradient(listOf(accent.copy(0.6f), accent.copy(0.15f), accent.copy(0.05f))),
                RoundedCornerShape(20.dp),
            ),
    ) {
        // Top accent stripe
        Box(Modifier.fillMaxWidth().height(2.dp).background(Brush.horizontalGradient(listOf(accent, accent.copy(0.3f), Color.Transparent))))
        Column(
            Modifier.padding(start = 18.dp, end = 18.dp, top = 18.dp, bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Title row
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    Modifier.size(48.dp).clip(RoundedCornerShape(12.dp))
                        .background(accent.copy(0.1f))
                        .border(1.dp, accent.copy(0.3f), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center,
                ) { Text(emoji, fontSize = 22.sp) }
                Column(Modifier.weight(1f)) {
                    Text(title, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                    Text(subtitle, fontSize = 11.sp, color = accent.copy(0.75f), fontWeight = FontWeight.SemiBold, letterSpacing = 0.3.sp)
                }
                // "Why?" toggle
                Box(
                    Modifier.clip(RoundedCornerShape(8.dp))
                        .background(accent.copy(0.07f))
                        .border(1.dp, accent.copy(0.25f), RoundedCornerShape(8.dp))
                        .clickable { showWhy = !showWhy }
                        .padding(horizontal = 8.dp, vertical = 5.dp),
                ) {
                    Text(
                        if (showWhy) "LESS" else "WHY?",
                        fontSize = 7.sp, letterSpacing = 1.sp,
                        color = accent.copy(0.85f), fontWeight = FontWeight.ExtraBold,
                    )
                }
            }

            // "Why" explanation
            if (showWhy) {
                Box(
                    Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(accent.copy(0.05f))
                        .border(1.dp, accent.copy(0.18f), RoundedCornerShape(10.dp))
                        .padding(12.dp),
                ) {
                    Text(why, fontSize = 12.sp, color = TextMuted, lineHeight = 18.sp)
                }
            }

            // Tool content
            content()
        }
    }
}

// ── Breathing Circle ──────────────────────────────────────────────────────────

private enum class BreathPhase(val label: String, val durationMs: Int) {
    INHALE("INHALE", 4000), HOLD_IN("HOLD", 4000), EXHALE("EXHALE", 4000), HOLD_OUT("HOLD", 4000)
}

@Composable
fun BreathingCircle(active: Boolean) {
    var phase by remember { mutableStateOf(BreathPhase.INHALE) }
    val targetScale = if (!active) 0.45f else when (phase) {
        BreathPhase.INHALE, BreathPhase.HOLD_IN -> 1f
        else -> 0.45f
    }
    val scale by animateFloatAsState(
        targetValue   = targetScale,
        animationSpec = tween(if (active) phase.durationMs else 600, easing = EaseInOutCubic),
        label         = "breathScale",
        finishedListener = { if (active) phase = BreathPhase.values()[(phase.ordinal + 1) % 4] },
    )
    val glowAlpha by animateFloatAsState(
        targetValue   = if (active) 0.35f else 0.1f,
        animationSpec = tween(600),
        label         = "glowAlpha",
    )

    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxWidth().height(200.dp)) {
        // Outer glow halo
        androidx.compose.foundation.Canvas(modifier = Modifier.size(200.dp)) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(NeonCyan.copy(glowAlpha * scale), NeonPurple.copy(glowAlpha * 0.3f * scale), Color.Transparent),
                    radius = size.minDimension / 2f * scale,
                    center = center,
                ),
            )
        }
        // Middle ring
        Box(
            Modifier.size(160.dp).scale(scale * 0.75f + 0.25f).clip(CircleShape)
                .background(Color.Transparent)
                .border(1.dp, NeonCyan.copy(0.2f), CircleShape),
        )
        // Core circle
        Box(
            Modifier.size(120.dp).scale(scale).clip(CircleShape)
                .background(Brush.radialGradient(listOf(NeonCyan.copy(0.18f), NeonPurple.copy(0.08f), Color.Transparent)))
                .border(2.dp, Brush.sweepGradient(listOf(NeonCyan, NeonPurple, NeonCyan)), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            if (active) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(phase.label, fontSize = 11.sp, letterSpacing = 2.sp, color = NeonCyan, fontWeight = FontWeight.ExtraBold)
                    Text("4s", fontSize = 9.sp, color = NeonCyan.copy(0.6f), fontWeight = FontWeight.SemiBold)
                }
            } else {
                Text("4-4-4-4", fontSize = 10.sp, letterSpacing = 1.sp, color = NeonCyan.copy(0.5f), fontWeight = FontWeight.Bold)
            }
        }
    }
}

// ── Focus Dot Overlay ─────────────────────────────────────────────────────────

@Composable
fun FocusDotOverlay(onExit: () -> Unit) {
    var secsLeft by remember { mutableStateOf(30) }
    LaunchedEffect(Unit) {
        while (secsLeft > 0) { kotlinx.coroutines.delay(1_000); secsLeft-- }
        onExit()
    }
    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(
        initialValue = 0.85f, targetValue = 1.15f,
        animationSpec = infiniteRepeatable(tween(900, easing = EaseInOutSine), RepeatMode.Reverse),
        label = "dotPulse",
    )
    Box(
        Modifier.fillMaxSize().background(Color(0xFF040008)).clickable { onExit() },
        contentAlignment = Alignment.Center,
    ) {
        // Glow halo
        androidx.compose.foundation.Canvas(modifier = Modifier.size(120.dp).scale(pulse)) {
            drawCircle(brush = Brush.radialGradient(listOf(NeonPurple.copy(0.3f), Color.Transparent)))
        }
        // The dot
        Box(Modifier.size(18.dp).scale(pulse).clip(CircleShape).background(NeonPurple))

        Box(Modifier.fillMaxSize().padding(bottom = 80.dp), contentAlignment = Alignment.BottomCenter) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Focus on the dot — clear your mind",
                    fontSize = 13.sp, color = Color.White.copy(0.3f),
                    fontWeight = FontWeight.Medium, letterSpacing = 0.5.sp,
                )
                Text("${secsLeft}s  •  tap to exit", fontSize = 11.sp, color = Color.White.copy(0.2f))
            }
        }
    }
}

// ── Zen Mode Overlay ──────────────────────────────────────────────────────────

@Composable
fun ZenModeOverlay(goal: String, onExit: () -> Unit) {
    val pulse by rememberInfiniteTransition(label = "zen").animateFloat(
        initialValue = 0.97f, targetValue = 1.03f,
        animationSpec = infiniteRepeatable(tween(3000, easing = EaseInOutSine), RepeatMode.Reverse),
        label = "zenPulse",
    )
    Box(
        Modifier.fillMaxSize().background(Color(0xFF020010)),
        contentAlignment = Alignment.Center,
    ) {
        // Soft background glow
        androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(NeonPink.copy(0.08f), NeonPurple.copy(0.04f), Color.Transparent),
                    radius = size.minDimension * 0.6f,
                    center = center,
                ),
            )
        }
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(48.dp).scale(pulse),
        ) {
            Text(
                "NOW FOCUS ON",
                fontSize = 10.sp, letterSpacing = 3.sp,
                color = NeonPink.copy(0.5f), fontWeight = FontWeight.ExtraBold,
            )
            Spacer(Modifier.height(20.dp))
            Text(
                goal,
                fontSize = 30.sp, fontWeight = FontWeight.ExtraBold,
                color = Color.White, textAlign = TextAlign.Center, lineHeight = 42.sp,
            )
            Spacer(Modifier.height(20.dp))
            Box(Modifier.width(60.dp).height(2.dp).background(Brush.horizontalGradient(listOf(NeonPink, NeonCyan))))
        }
        Box(Modifier.fillMaxSize().padding(bottom = 60.dp), contentAlignment = Alignment.BottomCenter) {
            TextButton(onClick = onExit) {
                Text("EXIT ZEN MODE", fontSize = 10.sp, letterSpacing = 2.sp, color = Color.White.copy(0.3f))
            }
        }
    }
}
