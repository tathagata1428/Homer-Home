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
            Column(Modifier.weight(1f)) {
                Text("Ambient Sounds", fontSize = 26.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.sp, color = TextPrimary)
            }
            // Reload button — fixes YouTube API load failures
            Box(
                Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
                    .background(BorderDefault.copy(alpha = 0.2f))
                    .border(1.dp, BorderDefault, RoundedCornerShape(12.dp))
                    .clickable { vm.reloadWebView() },
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Filled.Refresh, null, tint = TextMuted, modifier = Modifier.size(20.dp)) }
        }

        // ── Presets ───────────────────────────────────────────────────────
        Box(
            Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(BgCard)
                .border(1.dp, BorderDefault, RoundedCornerShape(16.dp))
                .padding(16.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Presets",
                        fontSize = 9.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    if (anyPlaying) {
                        Box(
                            Modifier.clip(RoundedCornerShape(20.dp))
                                .background(AccentBlue.copy(0.08f))
                                .border(1.dp, AccentBlue.copy(0.3f), RoundedCornerShape(20.dp))
                                .clickable { vm.stopAll() }
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                        ) {
                            Text("⏹ Stop all", fontSize = 10.sp, color = AccentBlue, fontWeight = FontWeight.Bold, letterSpacing = 0.sp)
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
                                .background(AccentBlue.copy(0.06f))
                                .border(1.dp, BorderDefault, RoundedCornerShape(10.dp))
                                .clickable { vm.applyPreset(preset) }
                                .padding(horizontal = 14.dp, vertical = 9.dp),
                        ) {
                            Text(preset.label, fontSize = 12.sp, color = AccentBlue, fontWeight = FontWeight.SemiBold)
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
                .background(BgCardAlt)
                .border(1.dp, BorderDefault, RoundedCornerShape(10.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(Icons.Filled.Info, null, tint = TextMuted, modifier = Modifier.size(14.dp))
            Text(
                "If sounds don't play, tap ↻ to reload the audio engine",
                fontSize = 11.sp, color = TextMuted, fontWeight = FontWeight.Medium,
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
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (state.playing) AccentBlue.copy(alpha = 0.06f) else BgCard)
            .border(1.dp, if (state.playing) AccentBlue.copy(0.3f) else BorderDefault, RoundedCornerShape(16.dp))
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
                        .background(if (state.playing) AccentBlue.copy(0.12f) else BgCardAlt)
                        .border(
                            1.5.dp,
                            if (state.playing) AccentBlue else BorderDefault,
                            CircleShape,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        if (state.playing) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = null,
                        tint = if (state.playing) AccentBlue else TextMuted,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
            Text(
                sound.label,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = if (state.playing) AccentBlue else TextMuted,
                letterSpacing = 0.sp,
            )
            if (state.playing) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Vol", fontSize = 8.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                    Text("${state.volume}%", fontSize = 9.sp, color = AccentBlue, fontWeight = FontWeight.Bold)
                }
                Slider(
                    value = state.volume.toFloat(),
                    onValueChange = { onVolume(it.toInt()) },
                    valueRange = 0f..100f,
                    modifier = Modifier.fillMaxWidth(),
                    colors = SliderDefaults.colors(
                        thumbColor = AccentBlue,
                        activeTrackColor = AccentBlue,
                        inactiveTrackColor = BorderDefault,
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
