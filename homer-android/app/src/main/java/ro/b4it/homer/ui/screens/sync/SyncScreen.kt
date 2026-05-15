package ro.b4it.homer.ui.screens.sync

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*

@Composable
fun SyncScreen(vm: SyncViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()

    Column(
        Modifier.fillMaxSize().background(BgPrimary).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Sync", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

        HomerCard {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(
                        Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
                            .background((if (state.isBogdan) AccentGreen else TextSubtle).copy(0.15f)),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.Filled.Sync, null, tint = if (state.isBogdan) AccentGreen else TextSubtle, modifier = Modifier.size(22.dp)) }
                    Column {
                        Text(
                            if (state.isBogdan) "Supabase Sync Active" else "Sync Unavailable",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            if (state.isBogdan) "Data syncs to Supabase field_state table" else "Sign in as Bogdan to enable sync",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextMuted,
                        )
                    }
                }

                Text(state.lastSyncMsg, style = MaterialTheme.typography.labelSmall, color = TextMuted)

                if (state.error != null) {
                    Text(state.error!!, style = MaterialTheme.typography.labelSmall, color = AccentRed)
                }

                Button(
                    onClick = vm::syncNow,
                    enabled = !state.syncing,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = AccentBlue),
                ) {
                    if (state.syncing) {
                        CircularProgressIndicator(Modifier.size(18.dp), color = androidx.compose.ui.graphics.Color.White, strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Filled.Sync, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Sync Now")
                    }
                }
            }
        }

        HomerCard {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Sync Scope", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                listOf(
                    "📝 Notes", "💰 Expenses", "✅ Habits",
                    "📥 Inbox", "🔗 Links", "⏱ Pomodoro Tasks",
                ).forEach { item ->
                    Text("  $item", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                }
            }
        }
    }
}
