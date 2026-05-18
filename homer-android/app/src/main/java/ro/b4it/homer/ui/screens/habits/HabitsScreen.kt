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
                    Text("HABITS", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 4.sp, color = TextPrimary)
                    Box(Modifier.width(54.dp).height(2.dp).background(Brush.horizontalGradient(listOf(NeonPink, NeonCyan))))
                }
                Box(
                    Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
                        .background(NeonPink.copy(0.1f))
                        .border(1.dp, NeonPink.copy(0.55f), RoundedCornerShape(12.dp))
                        .clickable { showAdd = true },
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Filled.Add, null, tint = NeonPink, modifier = Modifier.size(20.dp)) }
            }
        }

        // ── Today's Mission card ─────────────────────────────────────────────
        item {
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                    .background(BgCard)
                    .border(
                        1.dp,
                        Brush.linearGradient(
                            if (allDone) listOf(NeonCyan, NeonGold.copy(0.8f))
                            else listOf(NeonPink, NeonCyan.copy(0.6f))
                        ),
                        RoundedCornerShape(18.dp),
                    )
                    .padding(18.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("TODAY'S MISSION", fontSize = 9.sp, letterSpacing = 2.5.sp, color = NeonPink.copy(0.75f), fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(4.dp))
                            Text("$doneToday / $total", fontSize = 38.sp, fontWeight = FontWeight.ExtraBold, color = if (allDone) NeonCyan else NeonPink)
                        }
                        if (allDone) {
                            Box(
                                Modifier.clip(RoundedCornerShape(12.dp))
                                    .background(NeonCyan.copy(0.08f))
                                    .border(1.dp, NeonCyan.copy(0.6f), RoundedCornerShape(12.dp))
                                    .padding(horizontal = 14.dp, vertical = 10.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("PERFECT\nDAY  ✓", fontSize = 10.sp, letterSpacing = 1.2.sp, color = NeonCyan, fontWeight = FontWeight.ExtraBold, lineHeight = 15.sp)
                            }
                        } else {
                            Box(
                                Modifier.size(58.dp).clip(CircleShape)
                                    .background(NeonPink.copy(0.07f))
                                    .border(1.dp, NeonPink.copy(0.4f), CircleShape),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("${(pct * 100).toInt()}%", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = NeonPink)
                            }
                        }
                    }
                    Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(BgCardAlt)) {
                        if (pct > 0f) {
                            Box(
                                Modifier.fillMaxWidth(pct).height(6.dp).clip(RoundedCornerShape(3.dp))
                                    .background(Brush.horizontalGradient(if (allDone) listOf(NeonCyan, NeonGold) else listOf(NeonPink, NeonCyan)))
                            )
                        }
                    }
                    if (total > 0) {
                        val filled = (pct * 20).toInt()
                        Text(
                            "${"▓".repeat(filled)}${"░".repeat(20 - filled)}  ${(pct * 100).toInt()}%",
                            fontSize = 11.sp,
                            color = if (allDone) NeonCyan.copy(0.5f) else NeonPink.copy(0.4f),
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
                        Text("NO HABITS YET", fontSize = 10.sp, letterSpacing = 3.sp, color = NeonPink.copy(0.6f), fontWeight = FontWeight.Bold)
                        Text("Start building your Vice City routine", color = TextMuted, style = MaterialTheme.typography.bodySmall)
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
    val rawColor = try { Color(android.graphics.Color.parseColor(habit.color)) } catch (_: Exception) { NeonPink }
    val accent   = if (todayDone) NeonCyan else rawColor

    Box(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(BgCard)
            .border(
                1.dp,
                Brush.linearGradient(listOf(accent.copy(if (todayDone) 0.65f else 0.3f), accent.copy(0.1f))),
                RoundedCornerShape(16.dp),
            ),
    ) {
        Row(Modifier.height(IntrinsicSize.Min)) {
            // Left accent stripe
            Box(Modifier.width(3.dp).fillMaxHeight().background(Brush.verticalGradient(listOf(accent, accent.copy(0.3f)))))

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
                                    .background(NeonPink.copy(0.08f))
                                    .border(1.dp, NeonPink.copy(0.28f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 5.dp, vertical = 2.dp),
                            ) {
                                Text(habit.freq.uppercase(), fontSize = 7.sp, letterSpacing = 1.sp, color = NeonPink.copy(0.85f), fontWeight = FontWeight.Bold)
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
                                .background(if (todayDone) NeonCyan.copy(0.12f) else NeonPink.copy(0.07f))
                                .border(
                                    1.5.dp,
                                    if (todayDone) NeonCyan.copy(0.8f) else NeonPink.copy(0.45f),
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
                                    Icon(Icons.Filled.CheckCircle, null, tint = NeonCyan, modifier = Modifier.size(18.dp))
                                    Text("DONE", fontSize = 7.sp, letterSpacing = 1.sp, color = NeonCyan, fontWeight = FontWeight.ExtraBold)
                                } else {
                                    Icon(Icons.Filled.RadioButtonUnchecked, null, tint = NeonPink.copy(0.7f), modifier = Modifier.size(18.dp))
                                    Text("MARK", fontSize = 7.sp, letterSpacing = 1.sp, color = NeonPink.copy(0.7f), fontWeight = FontWeight.ExtraBold)
                                }
                            }
                        }
                        IconButton(onClick = onDelete, Modifier.size(18.dp)) {
                            Icon(Icons.Filled.Close, null, tint = TextSubtle.copy(0.3f), modifier = Modifier.size(11.dp))
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
                                color = if (isToday) NeonPink.copy(0.8f) else TextSubtle.copy(0.55f),
                                fontWeight = if (isToday) FontWeight.ExtraBold else FontWeight.Normal,
                            )
                            Box(
                                Modifier.size(24.dp).clip(CircleShape)
                                    .background(when {
                                        isDone && isToday -> NeonCyan.copy(0.22f)
                                        isDone            -> NeonCyan.copy(0.12f)
                                        isToday           -> NeonPink.copy(0.08f)
                                        else              -> BgCardAlt
                                    })
                                    .border(
                                        1.dp,
                                        when {
                                            isDone && isToday -> NeonCyan.copy(0.9f)
                                            isDone            -> NeonCyan.copy(0.45f)
                                            isToday           -> NeonPink.copy(0.5f)
                                            else              -> Color(0x10FFFFFF)
                                        },
                                        CircleShape,
                                    ),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (isDone) {
                                    Icon(Icons.Filled.Check, null, tint = NeonCyan, modifier = Modifier.size(12.dp))
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
        focusedBorderColor   = NeonPink,
        unfocusedBorderColor = NeonPink.copy(0.3f),
        focusedTextColor     = TextPrimary,
        unfocusedTextColor   = TextPrimary,
        focusedLabelColor    = NeonPink,
        cursorColor          = NeonPink,
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor   = BgCard,
        shape            = RoundedCornerShape(20.dp),
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("NEW HABIT", fontSize = 13.sp, letterSpacing = 2.5.sp, color = NeonPink, fontWeight = FontWeight.ExtraBold)
                Box(Modifier.width(40.dp).height(1.5.dp).background(Brush.horizontalGradient(listOf(NeonPink, NeonCyan))))
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
                Text("FREQUENCY", fontSize = 9.sp, letterSpacing = 2.sp, color = NeonPink.copy(0.65f), fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("daily", "weekdays", "weekly").forEach { f ->
                        val sel = freq == f
                        Box(
                            Modifier.clip(RoundedCornerShape(8.dp))
                                .background(if (sel) NeonPink.copy(0.14f) else Color.Transparent)
                                .border(1.dp, if (sel) NeonPink.copy(0.8f) else NeonPink.copy(0.22f), RoundedCornerShape(8.dp))
                                .clickable { freq = f }
                                .padding(horizontal = 12.dp, vertical = 7.dp),
                        ) {
                            Text(f.uppercase(), fontSize = 9.sp, letterSpacing = 1.sp, color = if (sel) NeonPink else TextMuted, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Box(
                Modifier.clip(RoundedCornerShape(10.dp))
                    .background(Brush.linearGradient(listOf(NeonPink, NeonCyan)))
                    .clickable { if (name.isNotBlank()) onAdd(name, emoji, color, cat, freq) }
                    .padding(horizontal = 22.dp, vertical = 10.dp),
            ) { Text("ADD", fontSize = 11.sp, letterSpacing = 1.5.sp, color = Color.White, fontWeight = FontWeight.ExtraBold) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("CANCEL", fontSize = 10.sp, letterSpacing = 1.sp, color = TextMuted) }
        },
    )
}
