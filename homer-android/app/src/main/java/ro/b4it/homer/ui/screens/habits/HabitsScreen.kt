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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.Habit
import ro.b4it.homer.data.local.entity.HabitCompletion
import ro.b4it.homer.ui.theme.*
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

private fun streakDays(habitId: String, completions: List<HabitCompletion>): Int {
    val dates = completions.filter { it.habitClientId == habitId }.map { it.date }.toSet()
    var streak = 0; var day = LocalDate.now()
    while (dates.contains(day.toString())) { streak++; day = day.minusDays(1) }
    return streak
}

@Composable
fun HabitsScreen(vm: HabitsViewModel = hiltViewModel()) {
    val habits      by vm.habits.collectAsStateWithLifecycle(emptyList())
    val completions by vm.todayCompletions.collectAsStateWithLifecycle(emptyList())
    val recent      by vm.recentCompletions.collectAsStateWithLifecycle(emptyList())
    var showAdd     by remember { mutableStateOf(false) }
    val today = LocalDate.now().toString()

    val doneToday = completions.count { c -> habits.any { h -> h.clientId == c.habitClientId } }
    val total     = habits.size
    val pct       = if (total > 0) doneToday.toFloat() / total else 0f
    val allDone   = doneToday == total && total > 0

    LazyColumn(
        Modifier.fillMaxSize().background(BgPrimary),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // ── Header ──────────────────────────────────────────────────────────
        item {
            Row(Modifier.padding(top = 4.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Habits", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                }
                Box(
                    Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
                        .background(AccentBlue.copy(0.08f))
                        .border(1.dp, AccentBlue.copy(0.25f), RoundedCornerShape(12.dp))
                        .clickable { showAdd = true },
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Filled.Add, null, tint = AccentBlue, modifier = Modifier.size(20.dp)) }
            }
        }

        // ── Today's Mission card ─────────────────────────────────────────────
        item {
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                    .background(BgCard)
                    .border(1.dp, BorderDefault, RoundedCornerShape(18.dp))
                    .padding(18.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Today's mission", fontSize = 11.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(4.dp))
                            Text("$doneToday / $total", fontSize = 38.sp, fontWeight = FontWeight.ExtraBold, color = if (allDone) AccentGreen else AccentBlue)
                        }
                        if (allDone) {
                            Box(
                                Modifier.clip(RoundedCornerShape(12.dp))
                                    .background(AccentGreen.copy(0.08f))
                                    .border(1.dp, AccentGreen.copy(0.6f), RoundedCornerShape(12.dp))
                                    .padding(horizontal = 14.dp, vertical = 10.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("Perfect\nday  ✓", fontSize = 10.sp, color = AccentGreen, fontWeight = FontWeight.Bold, lineHeight = 15.sp)
                            }
                        } else {
                            Box(
                                Modifier.size(58.dp).clip(CircleShape)
                                    .background(AccentBlue.copy(0.07f))
                                    .border(1.dp, AccentBlue.copy(0.4f), CircleShape),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("${(pct * 100).toInt()}%", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = AccentBlue)
                            }
                        }
                    }
                    Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(BgCardAlt)) {
                        if (pct > 0f) {
                            Box(
                                Modifier.fillMaxWidth(pct).height(6.dp).clip(RoundedCornerShape(3.dp))
                                    .background(if (allDone) AccentGreen else AccentBlue)
                            )
                        }
                    }
                    if (total > 0) {
                        val filled = (pct * 20).toInt()
                        Text(
                            "${"▓".repeat(filled)}${"░".repeat(20 - filled)}  ${(pct * 100).toInt()}%",
                            fontSize = 11.sp,
                            color = TextSubtle.copy(0.5f),
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                }
            }
        }

        if (habits.isEmpty()) {
            item {
                Box(Modifier.fillMaxWidth().padding(vertical = 60.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("🌴", fontSize = 52.sp)
                        Text("No habits yet", fontSize = 14.sp, color = TextMuted, fontWeight = FontWeight.Medium)
                        Text("Start building your daily routine", color = TextMuted, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }

        items(habits) { habit ->
            val done   = completions.any { it.habitClientId == habit.clientId }
            val streak = streakDays(habit.clientId, recent)
            // last 7 days: index 0 = 6 days ago, index 6 = today
            val weekDates = (6 downTo 0).map { daysAgo ->
                val date  = LocalDate.now().minusDays(daysAgo.toLong()).toString()
                val isDone = recent.any { it.habitClientId == habit.clientId && it.date == date }
                Pair(date, isDone)
            }
            HabitRow(
                habit       = habit,
                todayDone   = done,
                streak      = streak,
                weekDates   = weekDates,
                onToggle    = { vm.toggleCompletion(habit, today, done) },
                onToggleDate= { date, isDone -> vm.toggleCompletion(habit, date, isDone) },
                onDelete    = { vm.deleteHabit(habit) },
            )
        }
    }

    if (showAdd) {
        AddHabitDialog(
            onAdd     = { name, emoji, color, cat, freq -> vm.addHabit(name, emoji, color, cat, freq); showAdd = false },
            onDismiss = { showAdd = false },
        )
    }
}

// ── Habit row ─────────────────────────────────────────────────────────────────

@Composable
fun HabitRow(
    habit: Habit,
    todayDone: Boolean,
    streak: Int,
    weekDates: List<Pair<String, Boolean>>,
    onToggle: () -> Unit,
    onToggleDate: (date: String, done: Boolean) -> Unit,
    onDelete: () -> Unit,
) {
    val rawColor = try { Color(android.graphics.Color.parseColor(habit.color)) } catch (_: Exception) { AccentBlue }
    val accent   = if (todayDone) AccentGreen else rawColor

    Box(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(BgCard)
            .border(1.dp, BorderDefault, RoundedCornerShape(16.dp)),
    ) {
        Row(Modifier.height(IntrinsicSize.Min)) {
            // Left accent stripe
            Box(Modifier.width(3.dp).fillMaxHeight().background(accent))

            Column(
                Modifier.weight(1f).padding(start = 12.dp, end = 10.dp, top = 10.dp, bottom = 10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                // ── Top row: emoji | name+freq | DONE button ──────────────
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    // Emoji badge
                    Box(
                        Modifier.size(42.dp).clip(RoundedCornerShape(10.dp))
                            .background(accent.copy(0.08f))
                            .border(1.dp, accent.copy(0.28f), RoundedCornerShape(10.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            if (habit.emoji.isNotBlank()) habit.emoji else habit.name.take(1).uppercase(),
                            fontSize = if (habit.emoji.isNotBlank()) 20.sp else 16.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = accent,
                        )
                    }

                    // Name + freq
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(
                            habit.name,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = if (todayDone) TextSubtle else TextPrimary,
                            textDecoration = if (todayDone) TextDecoration.LineThrough else TextDecoration.None,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier.clip(RoundedCornerShape(4.dp))
                                    .background(AccentBlue.copy(0.08f))
                                    .border(1.dp, AccentBlue.copy(0.25f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 5.dp, vertical = 2.dp),
                            ) {
                                Text(habit.freq.replaceFirstChar { it.uppercase() }, fontSize = 7.sp, color = AccentBlue.copy(0.85f), fontWeight = FontWeight.SemiBold)
                            }
                            if (streak > 0) {
                                Text("🔥 $streak day streak", fontSize = 10.sp, color = NeonGold, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }

                    // ── DONE button (right side, clearly tappable) ─────────
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Box(
                            Modifier.width(60.dp).height(44.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (todayDone) AccentGreen.copy(0.12f) else AccentBlue.copy(0.07f))
                                .border(
                                    1.5.dp,
                                    if (todayDone) AccentGreen.copy(0.8f) else AccentBlue.copy(0.45f),
                                    RoundedCornerShape(10.dp),
                                )
                                .clickable(onClick = onToggle),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(2.dp),
                            ) {
                                if (todayDone) {
                                    Icon(Icons.Filled.CheckCircle, null, tint = AccentGreen, modifier = Modifier.size(18.dp))
                                    Text("Done", fontSize = 7.sp, color = AccentGreen, fontWeight = FontWeight.SemiBold)
                                } else {
                                    Icon(Icons.Filled.RadioButtonUnchecked, null, tint = AccentBlue.copy(0.7f), modifier = Modifier.size(18.dp))
                                    Text("Mark", fontSize = 7.sp, color = AccentBlue.copy(0.7f), fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                        IconButton(onClick = onDelete, Modifier.size(36.dp)) {
                            Icon(Icons.Filled.DeleteOutline, null, tint = AccentRed.copy(0.5f), modifier = Modifier.size(16.dp))
                        }
                    }
                }

                // ── 7-day mini calendar — tap any day to toggle ────────────
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    weekDates.forEachIndexed { idx, (date, isDone) ->
                        val isToday = idx == weekDates.lastIndex
                        val dayLabel = if (isToday) "NOW"
                        else LocalDate.parse(date).dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault()).take(2).uppercase()

                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(3.dp),
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .clickable { onToggleDate(date, isDone) }
                                .padding(horizontal = 3.dp, vertical = 2.dp),
                        ) {
                            Text(
                                dayLabel,
                                fontSize = 6.sp,
                                letterSpacing = 0.3.sp,
                                color = if (isToday) AccentBlue.copy(0.8f) else TextSubtle.copy(0.55f),
                                fontWeight = if (isToday) FontWeight.ExtraBold else FontWeight.Normal,
                            )
                            Box(
                                Modifier.size(24.dp).clip(CircleShape)
                                    .background(when {
                                        isDone && isToday -> AccentGreen.copy(0.22f)
                                        isDone            -> AccentGreen.copy(0.12f)
                                        isToday           -> AccentBlue.copy(0.08f)
                                        else              -> BgCardAlt
                                    })
                                    .border(
                                        1.dp,
                                        when {
                                            isDone && isToday -> AccentGreen.copy(0.9f)
                                            isDone            -> AccentGreen.copy(0.45f)
                                            isToday           -> AccentBlue.copy(0.5f)
                                            else              -> BorderDefault
                                        },
                                        CircleShape,
                                    ),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (isDone) {
                                    Icon(Icons.Filled.Check, null, tint = AccentGreen, modifier = Modifier.size(12.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Add habit dialog ──────────────────────────────────────────────────────────

@Composable
fun AddHabitDialog(onAdd: (String, String, String, String, String) -> Unit, onDismiss: () -> Unit) {
    var name  by remember { mutableStateOf("") }
    var emoji by remember { mutableStateOf("") }
    var color by remember { mutableStateOf("#FF2D78") }
    var cat   by remember { mutableStateOf("") }
    var freq  by remember { mutableStateOf("daily") }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor   = AccentBlue,
        unfocusedBorderColor = AccentBlue.copy(0.3f),
        focusedTextColor     = TextPrimary,
        unfocusedTextColor   = TextPrimary,
        focusedLabelColor    = AccentBlue,
        cursorColor          = AccentBlue,
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor   = BgCard,
        shape            = RoundedCornerShape(20.dp),
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("New habit", fontSize = 13.sp, color = TextPrimary, fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                listOf(
                    Triple("Name *",      name,  { v: String -> name  = v }),
                    Triple("Emoji",       emoji, { v: String -> emoji = v }),
                    Triple("Color (hex)", color, { v: String -> color = v }),
                    Triple("Category",    cat,   { v: String -> cat   = v }),
                ).forEach { (label, value, setter) ->
                    OutlinedTextField(value = value, onValueChange = setter, label = { Text(label, fontSize = 12.sp) },
                        singleLine = true, modifier = Modifier.fillMaxWidth(), colors = fieldColors)
                }
                Text("Frequency", fontSize = 11.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("daily", "weekdays", "weekly").forEach { f ->
                        val sel = freq == f
                        Box(
                            Modifier.clip(RoundedCornerShape(8.dp))
                                .background(if (sel) AccentBlue.copy(0.14f) else Color.Transparent)
                                .border(1.dp, if (sel) AccentBlue.copy(0.8f) else AccentBlue.copy(0.22f), RoundedCornerShape(8.dp))
                                .clickable { freq = f }
                                .padding(horizontal = 12.dp, vertical = 7.dp),
                        ) {
                            Text(f.replaceFirstChar { it.uppercase() }, fontSize = 9.sp, color = if (sel) AccentBlue else TextMuted, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Box(
                Modifier.clip(RoundedCornerShape(10.dp))
                    .background(AccentBlue)
                    .clickable { if (name.isNotBlank()) onAdd(name, emoji, color, cat, freq) }
                    .padding(horizontal = 22.dp, vertical = 10.dp),
            ) { Text("Add", fontSize = 11.sp, color = Color.White, fontWeight = FontWeight.Bold) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", fontSize = 10.sp, color = TextMuted) }
        },
    )
}
