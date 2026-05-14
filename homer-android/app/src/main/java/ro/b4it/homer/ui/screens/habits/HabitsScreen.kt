package ro.b4it.homer.ui.screens.habits

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.Habit
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.screens.home.SmallChip
import ro.b4it.homer.ui.theme.*
import java.time.LocalDate

@Composable
fun HabitsScreen(vm: HabitsViewModel = hiltViewModel()) {
    val habits      by vm.habits.collectAsStateWithLifecycle(emptyList())
    val completions by vm.todayCompletions.collectAsStateWithLifecycle(emptyList())
    var showAdd     by remember { mutableStateOf(false) }
    val today = LocalDate.now().toString()

    LazyColumn(
        Modifier.fillMaxSize().background(BgPrimary),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Habits", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                IconButton(onClick = { showAdd = true }) { Icon(Icons.Filled.Add, null, tint = AccentBlue) }
            }
        }

        // Today's summary
        val doneToday = completions.count { c -> habits.any { h -> h.clientId == c.habitClientId } }
        item {
            HomerCard {
                Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Today's Progress", style = MaterialTheme.typography.titleSmall, color = TextMuted)
                    Text("$doneToday / ${habits.size}", style = MaterialTheme.typography.titleSmall, color = AccentBlue, fontWeight = FontWeight.Bold)
                }
            }
        }

        items(habits) { habit ->
            val done = completions.any { it.habitClientId == habit.clientId }
            HabitRow(
                habit = habit,
                done  = done,
                onToggle = { vm.toggleCompletion(habit, today, done) },
                onDelete = { vm.deleteHabit(habit) },
            )
        }
    }

    if (showAdd) {
        AddHabitDialog(onAdd = vm::addHabit, onDismiss = { showAdd = false })
    }
}

@Composable
fun HabitRow(habit: Habit, done: Boolean, onToggle: () -> Unit, onDelete: () -> Unit) {
    val color = try { Color(android.graphics.Color.parseColor(habit.color)) } catch (_: Exception) { AccentBlue }
    HomerCard {
        Row(
            Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.size(40.dp).clip(CircleShape)
                    .background(if (done) color else color.copy(alpha = 0.15f))
                    .clickable(onClick = onToggle),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = if (habit.emoji.isNotBlank()) habit.emoji else habit.name.take(1),
                    fontSize = if (habit.emoji.isNotBlank()) 20.sp else 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (done) TextPrimary else color,
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(habit.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(habit.freq, style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    if (habit.category.isNotBlank()) Text("• ${habit.category}", style = MaterialTheme.typography.labelSmall, color = TextSubtle)
                }
            }
            if (done) Icon(Icons.Filled.CheckCircle, null, tint = color, modifier = Modifier.size(22.dp))
            IconButton(onClick = onDelete, Modifier.size(28.dp)) {
                Icon(Icons.Filled.Close, null, tint = TextSubtle, modifier = Modifier.size(14.dp))
            }
        }
    }
}

@Composable
fun AddHabitDialog(onAdd: (String, String, String, String) -> Unit, onDismiss: () -> Unit) {
    var name  by remember { mutableStateOf("") }
    var emoji by remember { mutableStateOf("") }
    var color by remember { mutableStateOf("#3B82F6") }
    var cat   by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = BgCard,
        title = { Text("New Habit") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple("Name *", name, { v: String -> name = v }),
                    Triple("Emoji", emoji, { v: String -> emoji = v }),
                    Triple("Color (hex)", color, { v: String -> color = v }),
                    Triple("Category", cat, { v: String -> cat = v }),
                ).forEach { (label, value, setter) ->
                    OutlinedTextField(
                        value = value, onValueChange = setter, label = { Text(label) },
                        singleLine = true, modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedLabelColor = AccentBlue),
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { if (name.isNotBlank()) onAdd(name, emoji, color, cat) }) {
                Text("Add", color = AccentBlue)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } },
    )
}
