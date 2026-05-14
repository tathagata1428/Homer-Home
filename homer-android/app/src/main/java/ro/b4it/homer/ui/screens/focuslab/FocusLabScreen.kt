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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.screens.home.SmallChip
import ro.b4it.homer.ui.theme.*

@Composable
fun FocusLabScreen(vm: FocusLabViewModel = hiltViewModel()) {
    val brainDump  by vm.brainDump.collectAsStateWithLifecycle("")
    val zenGoal    by vm.zenGoal.collectAsStateWithLifecycle("")
    var zenMode    by remember { mutableStateOf(false) }
    var focusDot   by remember { mutableStateOf(false) }
    var breathing  by remember { mutableStateOf(false) }

    if (zenMode) {
        ZenModeOverlay(goal = zenGoal, onExit = { zenMode = false })
        return
    }
    if (focusDot) {
        FocusDotOverlay(onExit = { focusDot = false })
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().background(BgPrimary)
            .verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Focus Lab", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

        // Breathing
        HomerCard {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("Box Breathing", style = MaterialTheme.typography.titleSmall, color = TextMuted)
                Spacer(Modifier.height(12.dp))
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    BreathingCircle(active = breathing)
                }
                Spacer(Modifier.height(12.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    SmallChip(if (breathing) "Stop" else "Start") { breathing = !breathing }
                }
            }
        }

        // Focus dot
        HomerCard {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("Focus Dot (Trataka)", style = MaterialTheme.typography.titleSmall, color = TextMuted)
                Spacer(Modifier.height(4.dp))
                Text("30-second visual focus exercise", style = MaterialTheme.typography.bodySmall, color = TextSubtle)
                Spacer(Modifier.height(10.dp))
                SmallChip("Start Focus Dot") { focusDot = true }
            }
        }

        // Zen mode
        HomerCard {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("Zen Mode", style = MaterialTheme.typography.titleSmall, color = TextMuted)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = zenGoal,
                    onValueChange = vm::setZenGoal,
                    placeholder = { Text("What is your ONE goal?", color = TextSubtle) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AccentViolet,
                        unfocusedBorderColor = BorderDefault,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                    ),
                )
                Spacer(Modifier.height(8.dp))
                SmallChip("Enter Zen Mode") { if (zenGoal.isNotBlank()) zenMode = true }
            }
        }

        // Brain Dump
        HomerCard {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Brain Dump", style = MaterialTheme.typography.titleSmall, color = TextMuted)
                    Spacer(Modifier.weight(1f))
                    Text("Auto-saved", style = MaterialTheme.typography.labelSmall, color = TextSubtle)
                }
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = brainDump,
                    onValueChange = vm::setBrainDump,
                    placeholder = { Text("Dump everything on your mind here…", color = TextSubtle) },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
                    maxLines = 20,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AccentBlue,
                        unfocusedBorderColor = BorderDefault,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                    ),
                )
            }
        }
    }
}

// ---- Breathing circle ----

private enum class BreathPhase(val label: String, val durationMs: Int) {
    INHALE("Inhale", 4000), HOLD_IN("Hold", 4000), EXHALE("Exhale", 4000), HOLD_OUT("Hold", 4000)
}

@Composable
fun BreathingCircle(active: Boolean) {
    var phase by remember { mutableStateOf(BreathPhase.INHALE) }
    val scale by animateFloatAsState(
        targetValue  = if (!active) 0.5f else when (phase) { BreathPhase.INHALE, BreathPhase.HOLD_IN -> 1f; else -> 0.5f },
        animationSpec = tween(if (active) phase.durationMs else 300),
        label        = "breathScale",
        finishedListener = {
            if (active) {
                phase = BreathPhase.values()[(phase.ordinal + 1) % 4]
            }
        }
    )

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(160.dp)) {
            Box(
                Modifier.size(120.dp).scale(scale).clip(CircleShape)
                    .background(AccentBlue.copy(alpha = 0.3f))
                    .border(2.dp, AccentBlue, CircleShape)
            )
            if (active) Text(phase.label, color = TextPrimary, fontWeight = FontWeight.Bold)
        }
    }
}

// ---- Focus Dot overlay ----

@Composable
fun FocusDotOverlay(onExit: () -> Unit) {
    var secsLeft by remember { mutableStateOf(30) }
    LaunchedEffect(Unit) {
        while (secsLeft > 0) {
            kotlinx.coroutines.delay(1_000)
            secsLeft--
        }
        onExit()
    }
    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(
        initialValue = 0.9f, targetValue = 1.1f,
        animationSpec = infiniteRepeatable(tween(800), RepeatMode.Reverse),
        label = "dotPulse",
    )
    Box(
        Modifier.fillMaxSize().background(Color.Black).clickable { onExit() },
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(20.dp).scale(pulse).clip(CircleShape).background(AccentBlue))
        }
        Box(Modifier.fillMaxSize().padding(bottom = 40.dp), contentAlignment = Alignment.BottomCenter) {
            Text("${secsLeft}s  •  Tap to exit", color = Color.White.copy(alpha = 0.4f), style = MaterialTheme.typography.labelSmall)
        }
    }
}

// ---- Zen Mode overlay ----

@Composable
fun ZenModeOverlay(goal: String, onExit: () -> Unit) {
    Box(
        Modifier.fillMaxSize().background(Color.Black),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(40.dp),
        ) {
            Text(goal, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Color.White, textAlign = TextAlign.Center, lineHeight = 40.sp)
        }
        Box(Modifier.fillMaxSize().padding(bottom = 60.dp), contentAlignment = Alignment.BottomCenter) {
            TextButton(onClick = onExit) { Text("Exit Zen Mode", color = Color.White.copy(alpha = 0.4f)) }
        }
    }
}
