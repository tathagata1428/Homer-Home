package ro.b4it.homer.ui.screens.inbox

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.InboxItem
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*
import java.util.UUID

@Composable
fun InboxScreen(vm: InboxViewModel = hiltViewModel()) {
    val items  by vm.items.collectAsStateWithLifecycle(emptyList())
    var input  by remember { mutableStateOf("") }

    Column(Modifier.fillMaxSize().background(BgPrimary).imePadding()) {
        // Header
        Row(
            Modifier.fillMaxWidth().padding(16.dp, 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Quick Capture", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }
        // Quick capture input
        HomerCard(modifier = Modifier.padding(horizontal = 16.dp)) {
            Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = input, onValueChange = { input = it },
                    placeholder = { Text("Capture a thought, task, link…", color = TextSubtle) },
                    singleLine = true, modifier = Modifier.weight(1f),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary),
                )
                Spacer(Modifier.width(8.dp))
                IconButton(onClick = {
                    if (input.isNotBlank()) {
                        vm.capture(InboxItem(id = UUID.randomUUID().toString(), text = input, type = detectType(input)))
                        input = ""
                    }
                }) { Icon(Icons.Filled.Add, null, tint = AccentBlue) }
            }
        }

        LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(items) { item ->
                InboxItemRow(item = item, onDelete = { vm.delete(item) }, onProcess = { vm.process(item) })
            }
        }
    }
}

@Composable
fun InboxItemRow(item: InboxItem, onDelete: () -> Unit, onProcess: () -> Unit) {
    val (typeColor, typeLabel, actionLabel) = when (item.type) {
        "task"    -> Triple(AccentBlue,   "Task",    "→ Focus")
        "link"    -> Triple(AccentViolet, "Link",    "→ Links")
        "expense" -> Triple(AccentGreen,  "Expense", "→ Ledger")
        else      -> Triple(AccentAmber,  "Thought", null)
    }
    HomerCard {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.clip(RoundedCornerShape(6.dp)).background(typeColor.copy(0.15f)).padding(horizontal = 8.dp, vertical = 3.dp)
                ) { Text(typeLabel, style = MaterialTheme.typography.labelSmall, color = typeColor, fontWeight = FontWeight.Bold) }
                Spacer(Modifier.width(10.dp))
                Text(item.text, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f), maxLines = 2)
                IconButton(onClick = onDelete, Modifier.size(28.dp)) {
                    Icon(Icons.Filled.Close, null, tint = TextSubtle, modifier = Modifier.size(14.dp))
                }
            }
            if (actionLabel != null) {
                Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                    Box(
                        Modifier.clip(RoundedCornerShape(6.dp)).background(typeColor.copy(0.12f))
                            .clickable(onClick = onProcess).padding(horizontal = 10.dp, vertical = 4.dp),
                    ) {
                        Text(actionLabel, style = MaterialTheme.typography.labelSmall, color = typeColor, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

private fun detectType(text: String): String {
    val lower = text.lowercase()
    return when {
        lower.startsWith("http") || lower.contains(".com") || lower.contains(".ro") -> "link"
        lower.contains(Regex("\\d+(\\.\\d+)?\\s*(ron|lei|\\$|eur|€)")) -> "expense"
        lower.startsWith("todo") || lower.startsWith("task") || lower.contains("to do") -> "task"
        else -> "thought"
    }
}
