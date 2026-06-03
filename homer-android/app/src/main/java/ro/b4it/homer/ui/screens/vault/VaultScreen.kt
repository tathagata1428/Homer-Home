package ro.b4it.homer.ui.screens.vault

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import ro.b4it.homer.ui.navigation.Screen
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.screens.home.SmallChip
import ro.b4it.homer.ui.theme.*

@Composable
fun VaultScreen(navController: NavController, vm: VaultViewModel = hiltViewModel()) {
    val mode by vm.vaultMode.collectAsStateWithLifecycle()
    VaultDashboard(navController = navController, mode = mode, vm = vm)
}

// ---- Dashboard ----

private data class VaultTile(val icon: String, val label: String, val desc: String, val route: String)

private val TILES = listOf(
    VaultTile("📋", "Project Hub",         "Kanban boards",         Screen.Kanban.route),
    VaultTile("🎯", "Life Goals",          "Track your goals",      Screen.LifeGoals.route),
    VaultTile("🔑", "Passwords & Secrets", "Encrypted credentials", Screen.Secrets.route),
    VaultTile("📝", "Secret Notes",        "Encrypted notes",       Screen.SecretNotes.route),
    VaultTile("✅", "Habits",              "Daily habit tracker",   Screen.Habits.route),
    VaultTile("📅", "Calendar",            "Events & reminders",    Screen.Calendar.route),
    VaultTile("💰", "Expense Ledger",      "Track spending",        Screen.Ledger.route),
    VaultTile("🚗", "Car Tracker",         "Maintenance & docs",    Screen.Car.route),
)

@Composable
fun VaultDashboard(navController: NavController, mode: String, vm: VaultViewModel) {
    Column(
        Modifier.fillMaxSize().background(BgPrimary)
            .verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Vault", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            SmallChip(mode.replaceFirstChar { it.uppercase() }) { vm.toggleMode() }
        }

        TILES.forEach { tile ->
            HomerCard {
                Row(
                    Modifier.fillMaxWidth().clickable { navController.navigate(tile.route) }.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(tile.icon, fontSize = 28.sp, modifier = Modifier.width(44.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tile.label, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Text(tile.desc, style = MaterialTheme.typography.bodySmall, color = TextMuted)
                    }
                    Icon(Icons.Filled.ChevronRight, null, tint = TextSubtle)
                }
            }
        }
    }
}

