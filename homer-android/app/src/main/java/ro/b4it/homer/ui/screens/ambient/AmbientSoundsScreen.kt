package ro.b4it.homer.ui.screens.ambient

import android.webkit.JavascriptInterface
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.theme.*

@Composable
fun AmbientSoundsScreen() {
    val vm    = LocalAmbientVm.current
    val state by vm.state.collectAsStateWithLifecycle()
    val anyPlaying = state.any { it.value.playing }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // ── Header ────────────────────────────────────────────────────────
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("AMBIENT", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 4.sp, color = TextPrimary)
                Text("SOUNDS", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 4.sp, color = NeonCyan)
                Box(Modifier.width(54.dp).height(2.dp).background(Brush.horizontalGradient(listOf(NeonCyan, NeonPurple))))
            }
            // Reload button — fixes YouTube API load failures
            Box(
                Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
                    .background(NeonGold.copy(0.1f))
                    .border(1.dp, NeonGold.copy(0.55f), RoundedCornerShape(12.dp))
                    .clickable { vm.reloadWebView() },
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Filled.Refresh, null, tint = NeonGold, modifier = Modifier.size(20.dp)) }
        }

        // ── Presets ───────────────────────────────────────────────────────
        Box(
            Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(BgCard)
                .border(
                    1.dp,
                    Brush.linearGradient(listOf(NeonPink.copy(0.7f), NeonPurple.copy(0.4f), NeonCyan.copy(0.5f))),
                    RoundedCornerShape(16.dp),
                )
                .padding(16.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "PRESETS",
                        fontSize = 9.sp, letterSpacing = 3.sp, color = NeonPink.copy(0.75f), fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    if (anyPlaying) {
                        Box(
                            Modifier.clip(RoundedCornerShape(20.dp))
                                .background(NeonPink.copy(0.1f))
                                .border(1.dp, NeonPink.copy(0.5f), RoundedCornerShape(20.dp))
                                .clickable { vm.stopAll() }
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                        ) {
                            Text("⏹ STOP ALL", fontSize = 10.sp, color = NeonPink, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                        }
                    }
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                ) {
                    AmbientPreset.values().forEach { preset ->
                        Box(
                            Modifier.clip(RoundedCornerShape(10.dp))
                                .background(NeonCyan.copy(0.07f))
                                .border(1.dp, NeonCyan.copy(0.35f), RoundedCornerShape(10.dp))
                                .clickable { vm.applyPreset(preset) }
                                .padding(horizontal = 14.dp, vertical = 9.dp),
                        ) {
                            Text(preset.label, fontSize = 12.sp, color = NeonCyan, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }

        // ── Sound grid ────────────────────────────────────────────────────
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.heightIn(max = 1600.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(AmbientSound.values().toList()) { sound ->
                val s = state[sound] ?: SoundState()
                SoundCard(
                    sound    = sound,
                    state    = s,
                    onToggle = { vm.toggle(sound) },
                    onVolume = { vm.setVolume(sound, it) },
                )
            }
        }

        // ── Tip ───────────────────────────────────────────────────────────
        Row(
            Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(NeonGold.copy(0.05f))
                .border(1.dp, NeonGold.copy(0.2f), RoundedCornerShape(10.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(Icons.Filled.Info, null, tint = NeonGold.copy(0.6f), modifier = Modifier.size(14.dp))
            Text(
                "If sounds don't play, tap ↻ to reload the audio engine",
                fontSize = 11.sp, color = NeonGold.copy(0.65f), fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
private fun SoundCard(
    sound: AmbientSound,
    state: SoundState,
    onToggle: () -> Unit,
    onVolume: (Int) -> Unit,
) {
    val borderBrush = if (state.playing)
        Brush.linearGradient(listOf(NeonCyan.copy(0.85f), NeonPurple.copy(0.5f)))
    else
        Brush.linearGradient(listOf(NeonPink.copy(0.22f), NeonPurple.copy(0.12f)))

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (state.playing) NeonCyan.copy(alpha = 0.06f) else BgCard)
            .border(1.dp, borderBrush, RoundedCornerShape(16.dp))
            .clickable(onClick = onToggle)
            .padding(14.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(sound.emoji, fontSize = 28.sp)
                Box(
                    Modifier.size(34.dp).clip(CircleShape)
                        .background(if (state.playing) NeonCyan.copy(0.14f) else NeonPink.copy(0.06f))
                        .border(
                            1.5.dp,
                            if (state.playing) NeonCyan.copy(0.7f) else NeonPink.copy(0.28f),
                            CircleShape,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        if (state.playing) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = null,
                        tint = if (state.playing) NeonCyan else TextMuted,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
            Text(
                sound.label,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = if (state.playing) NeonCyan else TextMuted,
                letterSpacing = 0.5.sp,
            )
            if (state.playing) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("VOL", fontSize = 8.sp, letterSpacing = 1.sp, color = NeonCyan.copy(0.6f), fontWeight = FontWeight.Bold)
                    Text("${state.volume}%", fontSize = 9.sp, color = NeonCyan, fontWeight = FontWeight.Bold)
                }
                Slider(
                    value = state.volume.toFloat(),
                    onValueChange = { onVolume(it.toInt()) },
                    valueRange = 0f..100f,
                    modifier = Modifier.fillMaxWidth(),
                    colors = SliderDefaults.colors(
                        thumbColor = NeonCyan,
                        activeTrackColor = NeonCyan,
                        inactiveTrackColor = NeonPurple.copy(0.2f),
                    ),
                )
            }
        }
    }
}

/** JavaScript bridge — called from the WebView's HTML player. */
class JsBridge(private val vm: AmbientSoundsViewModel) {
    @JavascriptInterface
    fun onPlayerReady(key: String) = vm.onPlayerReady(key)
}
