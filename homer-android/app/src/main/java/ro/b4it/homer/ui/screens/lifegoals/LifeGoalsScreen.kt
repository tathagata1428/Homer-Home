package ro.b4it.homer.ui.screens.lifegoals

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
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.LifeGoal
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*
import java.util.UUID

@Composable
fun LifeGoalsScreen(vm: LifeGoalsViewModel = hiltViewModel()) {
    val goals   by vm.goals.collectAsStateWithLifecycle(emptyList())
    var showAdd by remember { mutableStateOf(false) }

    val total     = goals.size
    val inProgress= goals.count { it.status == "active" && it.progress < 100 }
    val completed = goals.count { it.progress >= 100 || it.status == "completed" }
    val rate      = if (total > 0) completed * 100 / total else 0

    LazyColumn(
        Modifier.fillMaxSize().background(BgPrimary),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Life Goals", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                IconButton(onClick = { showAdd = true }) { Icon(Icons.Filled.Add, null, tint = AccentBlue) }
            }
        }

        // Stats row
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple(total.toString(), "Total", AccentBlue),
                    Triple(inProgress.toString(), "Active", AccentAmber),
                    Triple(completed.toString(), "Done", AccentGreen),
                    Triple("$rate%", "Rate", AccentViolet),
                ).forEach { (value, label, color) ->
                    Box(
                        Modifier.weight(1f).clip(RoundedCornerShape(12.dp))
                            .background(color.copy(0.12f)).padding(10.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(value, style = MaterialTheme.typography.titleMedium, color = color, fontWeight = FontWeight.Bold)
                            Text(label, style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        }
                    }
                }
            }
        }

        items(goals) { goal ->
            GoalCard(goal = goal, onToggleComplete = { vm.toggleComplete(goal) }, onDelete = { vm.deleteGoal(goal) })
        }
    }

    if (showAdd) {
        AddGoalDialog(onAdd = vm::addGoal, onDismiss = { showAdd = false })
    }
}

@Composable
fun GoalCard(goal: LifeGoal, onToggleComplete: () -> Unit, onDelete: () -> Unit) {
    val done = goal.progress >= 100 || goal.status == "completed"
    HomerCard {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(goal.icon.ifBlank { "🎯" }, fontSize = 24.sp, modifier = Modifier.width(34.dp))
                Column(Modifier.weight(1f)) {
                    Text(goal.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                    if (goal.category.isNotBlank()) Text(goal.category, style = MaterialTheme.typography.labelSmall, color = TextMuted)
                }
                if (done) {
                    Box(Modifier.clip(RoundedCornerShape(20)).background(AccentGreen.copy(0.15f)).padding(horizontal = 8.dp, vertical = 3.dp)) {
                        Text("Done", style = MaterialTheme.typography.labelSmall, color = AccentGreen, fontWeight = FontWeight.Bold)
                    }
                }
                IconButton(onClick = onDelete, Modifier.size(28.dp)) {
                    Icon(Icons.Filled.Close, null, tint = TextSubtle, modifier = Modifier.size(14.dp))
                }
            }
            if (goal.description.isNotBlank()) Text(goal.description, style = MaterialTheme.typography.bodySmall, color = TextMuted)
            // Progress bar
            val pct = (goal.progress / 100f).coerceIn(0f, 1f)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f).height(6.dp).clip(RoundedCornerShape(3.dp)).background(BgCardAlt)) {
                    Box(Modifier.fillMaxWidth(pct).height(6.dp).clip(RoundedCornerShape(3.dp)).background(if (done) AccentGreen else AccentBlue))
                }
                Text("${goal.progress}%", style = MaterialTheme.typography.labelSmall, color = TextMuted)
            }
            if (goal.targetDate.isNotBlank()) Text("Target: ${goal.targetDate}", style = MaterialTheme.typography.labelSmall, color = TextSubtle)
            TextButton(onClick = onToggleComplete, contentPadding = PaddingValues(0.dp), modifier = Modifier.height(28.dp)) {
                Text(if (done) "Mark Active" else "Mark Complete", style = MaterialTheme.typography.labelSmall, color = if (done) AccentAmber else AccentGreen)
            }
        }
    }
}

@Composable
fun AddGoalDialog(onAdd: (String, String, String, String, String) -> Unit, onDismiss: () -> Unit) {
    var title  by remember { mutableStateOf("") }
    var desc   by remember { mutableStateOf("") }
    var cat    by remember { mutableStateOf("") }
    var icon   by remember { mutableStateOf("") }
    var target by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss, containerColor = BgCard,
        title = { Text("New Life Goal") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple("Title *", title, { v: String -> title = v }),
                    Triple("Description", desc, { v: String -> desc = v }),
                    Triple("Category", cat, { v: String -> cat = v }),
                    Triple("Icon (emoji)", icon, { v: String -> icon = v }),
                    Triple("Target date (YYYY-MM-DD)", target, { v: String -> target = v }),
                ).forEach { (label, value, setter) ->
                    OutlinedTextField(value = value, onValueChange = setter, label = { Text(label) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedLabelColor = AccentBlue))
                }
            }
        },
        confirmButton = { TextButton(onClick = { if (title.isNotBlank()) onAdd(title, desc, cat, icon, target) }) { Text("Add", color = AccentBlue) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } },
    )
}
