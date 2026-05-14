package ro.b4it.homer.ui.screens.vault

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
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
    val locked   by vm.locked.collectAsStateWithLifecycle()
    val mode     by vm.vaultMode.collectAsStateWithLifecycle()

    if (locked) {
        VaultLockScreen(vm = vm)
    } else {
        VaultDashboard(navController = navController, mode = mode, vm = vm)
    }
}

// ---- Lock screen ----

@Composable
fun VaultLockScreen(vm: VaultViewModel) {
    val error   by vm.lockError.collectAsStateWithLifecycle()
    val storedUser by vm.storedUser.collectAsStateWithLifecycle()
    var username by remember { mutableStateOf(storedUser ?: "") }
    var password by remember { mutableStateOf("") }
    var showPw   by remember { mutableStateOf(false) }
    var rememberMe by remember { mutableStateOf(false) }

    LaunchedEffect(storedUser) { if (storedUser != null && username.isEmpty()) username = storedUser!! }

    Box(
        Modifier.fillMaxSize().background(BgPrimary),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.width(380.dp).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Box(
                Modifier.size(72.dp).clip(RoundedCornerShape(50)).background(AccentBlue.copy(0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                Text("🔒", fontSize = 32.sp)
            }

            Text("Unlock Vault", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("Enter your credentials to access encrypted data", style = MaterialTheme.typography.bodySmall, color = TextMuted)

            if (error != null) {
                Text(error!!, color = AccentRed, style = MaterialTheme.typography.bodySmall)
            }

            OutlinedTextField(
                value = username, onValueChange = { username = it },
                label = { Text("Username") }, singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = vaultFieldColors(),
            )
            OutlinedTextField(
                value = password, onValueChange = { password = it },
                label = { Text("Password") }, singleLine = true,
                visualTransformation = if (showPw) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = { showPw = !showPw }) {
                        Icon(if (showPw) Icons.Filled.VisibilityOff else Icons.Filled.Visibility, null, tint = TextMuted)
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                colors = vaultFieldColors(),
            )

            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Checkbox(checked = rememberMe, onCheckedChange = { rememberMe = it },
                    colors = CheckboxDefaults.colors(checkedColor = AccentBlue, uncheckedColor = TextMuted, checkmarkColor = TextPrimary))
                Text("Remember me", style = MaterialTheme.typography.bodySmall, color = TextMuted)
            }

            Button(
                onClick = { vm.unlock(username.trim(), password, rememberMe) },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AccentBlue),
            ) {
                Text("Unlock Vault", fontWeight = FontWeight.SemiBold)
            }
        }
    }
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
            Spacer(Modifier.width(8.dp))
            IconButton(onClick = vm::lock) {
                Icon(Icons.Filled.Lock, "Lock", tint = TextMuted)
            }
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

@Composable
private fun vaultFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault,
    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
    focusedLabelColor = AccentBlue, unfocusedLabelColor = TextMuted,
)
