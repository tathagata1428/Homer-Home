package ro.b4it.homer.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*

@Composable
fun SettingsScreen(vm: SettingsViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()

    LazyColumn(
        Modifier.fillMaxSize().background(BgPrimary),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text("Settings", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }

        item {
            HomerCard {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Pomodoro", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = AccentBlue)

                    SettingSlider(
                        label = "Focus: ${state.focusMin} min",
                        value = state.focusMin.toFloat(),
                        range = 5f..90f,
                        onValueChange = { vm.setFocusMin(it.toInt()) },
                    )
                    SettingSlider(
                        label = "Short break: ${state.shortMin} min",
                        value = state.shortMin.toFloat(),
                        range = 1f..30f,
                        onValueChange = { vm.setShortMin(it.toInt()) },
                    )
                    SettingSlider(
                        label = "Long break: ${state.longMin} min",
                        value = state.longMin.toFloat(),
                        range = 5f..60f,
                        onValueChange = { vm.setLongMin(it.toInt()) },
                    )
                    SettingToggle("Auto-start next phase", state.autoStart, vm::setAutoStart)
                    SettingToggle("Notifications", state.notifications, vm::setNotifications)
                    SettingToggle("Sound effects", state.sfx, vm::setSfx)
                }
            }
        }

        item {
            HomerCard {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("App Info", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    InfoRow("Version", "1.0.0")
                    InfoRow("Package", "ro.b4it.homer")
                    InfoRow("Build", "Phase 16 – Complete")
                }
            }
        }
    }
}

@Composable
private fun SettingSlider(label: String, value: Float, range: ClosedFloatingPointRange<Float>, onValueChange: (Float) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = TextPrimary)
        Slider(
            value = value, onValueChange = onValueChange, valueRange = range,
            colors = SliderDefaults.colors(thumbColor = AccentBlue, activeTrackColor = AccentBlue, inactiveTrackColor = BorderDefault),
        )
    }
}

@Composable
private fun SettingToggle(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = TextPrimary, modifier = Modifier.weight(1f))
        Switch(
            checked = checked, onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = AccentBlue),
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = TextMuted, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.labelSmall, color = TextPrimary)
    }
}
