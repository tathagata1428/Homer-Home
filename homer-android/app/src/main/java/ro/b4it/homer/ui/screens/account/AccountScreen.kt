package ro.b4it.homer.ui.screens.account

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*

@Composable
fun AccountScreen(vm: AccountViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()

    Column(
        Modifier
            .fillMaxSize()
            .background(BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Account", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

        // Sync status card
        HomerCard {
            Row(
                Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                val active = state.isSyncConfigured
                Box(
                    Modifier.size(48.dp).clip(RoundedCornerShape(12.dp))
                        .background((if (active) AccentGreen else TextSubtle).copy(0.15f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        if (active) Icons.Filled.CloudDone else Icons.Filled.CloudOff,
                        null,
                        tint = if (active) AccentGreen else TextSubtle,
                        modifier = Modifier.size(28.dp),
                    )
                }
                Column {
                    Text(
                        if (active) "Cloud Sync Active" else "Sync Unavailable",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary,
                    )
                    Text(
                        if (active) "Syncing via CF Pages /api/sync" else "HOMER_ADMIN_HASH not configured",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (active) AccentGreen else TextMuted,
                    )
                }
            }
        }

        // Local data info card
        HomerCard {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Local-First Storage", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(
                    "All data is stored locally on device using Room. When sync is active, data is pushed to and pulled from the cloud automatically.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted,
                )
            }
        }
    }
}
