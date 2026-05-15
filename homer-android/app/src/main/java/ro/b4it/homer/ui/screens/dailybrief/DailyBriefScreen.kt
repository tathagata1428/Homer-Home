package ro.b4it.homer.ui.screens.dailybrief

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*

@Composable
fun DailyBriefScreen(vm: DailyBriefViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()

    LazyColumn(
        Modifier.fillMaxSize().background(BgPrimary),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Daily Brief", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                IconButton(onClick = vm::load) { Icon(Icons.Filled.Refresh, null, tint = AccentBlue) }
            }
        }

        if (state.loading) {
            item {
                Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AccentBlue)
                }
            }
            return@LazyColumn
        }

        // Quote
        item {
            HomerCard {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("✨", fontSize = 28.sp)
                    Text(
                        "\"${state.quote.text}\"",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextPrimary,
                        textAlign = TextAlign.Center,
                        fontWeight = FontWeight.Medium,
                    )
                    if (state.quote.author.isNotBlank()) {
                        Text("— ${state.quote.author}", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    }
                }
            }
        }

        // Stats row
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple(state.inProgressTasks.size.toString(), "In Progress", AccentAmber),
                    Triple(state.habits.size.toString(), "Habits", AccentGreen),
                    Triple(state.inboxCount.toString(), "Inbox", AccentViolet),
                    Triple("€%.0f".format(state.totalExpensesToday), "Today", AccentBlue),
                ).forEach { (val_, lbl, color) ->
                    Box(
                        Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(color.copy(0.12f)).padding(10.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(val_, style = MaterialTheme.typography.titleMedium, color = color, fontWeight = FontWeight.Bold)
                            Text(lbl, style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        }
                    }
                }
            }
        }

        // In-progress Kanban tasks
        if (state.inProgressTasks.isNotEmpty()) {
            item { SectionHeader("In Progress") }
            state.inProgressTasks.forEach { task ->
                item {
                    HomerCard {
                        Row(Modifier.fillMaxWidth().padding(12.dp, 10.dp), verticalAlignment = Alignment.CenterVertically) {
                            val priorityColor = when (task.priority) {
                                "high"     -> AccentAmber
                                "critical" -> AccentRed
                                "low"      -> AccentGreen
                                else       -> TextMuted
                            }
                            Box(Modifier.width(4.dp).height(36.dp).clip(RoundedCornerShape(2.dp)).background(priorityColor))
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text(task.summary, style = MaterialTheme.typography.bodySmall, color = TextPrimary, fontWeight = FontWeight.SemiBold)
                                if (task.dueDate.isNotBlank()) Text("Due: ${task.dueDate}", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                            }
                        }
                    }
                }
            }
        }

        // Habits
        if (state.habits.isNotEmpty()) {
            item { SectionHeader("Today's Habits") }
            state.habits.forEach { habit ->
                item {
                    HomerCard {
                        Row(Modifier.fillMaxWidth().padding(12.dp, 10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(habit.emoji.ifBlank { "✅" }, fontSize = 18.sp, modifier = Modifier.width(28.dp))
                            Text(habit.name, style = MaterialTheme.typography.bodySmall, color = TextPrimary, modifier = Modifier.weight(1f))
                            Text(habit.category.ifBlank { habit.freq }, style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        }
                    }
                }
            }
        }

        // Life goals
        if (state.lifeGoals.isNotEmpty()) {
            item { SectionHeader("Life Goals — Upcoming") }
            state.lifeGoals.forEach { goal ->
                item {
                    HomerCard {
                        Row(Modifier.fillMaxWidth().padding(12.dp, 10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(goal.icon.ifBlank { "🎯" }, fontSize = 18.sp, modifier = Modifier.width(28.dp))
                            Column(Modifier.weight(1f)) {
                                Text(goal.title, style = MaterialTheme.typography.bodySmall, color = TextPrimary, fontWeight = FontWeight.SemiBold)
                                if (goal.targetDate.isNotBlank()) Text("Target: ${goal.targetDate}", style = MaterialTheme.typography.labelSmall, color = AccentBlue)
                            }
                            val pct = (goal.progress / 100f).coerceIn(0f, 1f)
                            Text("${goal.progress}%", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(title, style = MaterialTheme.typography.labelMedium, color = TextMuted, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 2.dp))
}
