package ro.b4it.homer.ui.screens.journal

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.JournalEntry
import ro.b4it.homer.ui.theme.*
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val MONTH_FMT = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.getDefault())
private val DAY_FMT   = DateTimeFormatter.ofPattern("EEEE, d MMMM", Locale.getDefault())

@Composable
fun JournalScreen(
    onNewEntry: () -> Unit,
    onEntryClick: (String) -> Unit,
    vm: JournalViewModel = hiltViewModel(),
) {
    val entries   by vm.entries.collectAsStateWithLifecycle(emptyList())
    val streak    by vm.streak.collectAsStateWithLifecycle()
    val weekMoods by vm.weekMoods.collectAsStateWithLifecycle()
    val prompt    by vm.prompt.collectAsStateWithLifecycle()
    val loading   by vm.promptLoading.collectAsStateWithLifecycle()

    val today = LocalDate.now().toString()
    val hasTodayEntry = entries.any { it.date == today }

    // Group entries by month
    val grouped = remember(entries) {
        entries.groupBy { entry ->
            runCatching {
                LocalDate.parse(entry.date).format(MONTH_FMT)
            }.getOrDefault("")
        }.entries.toList()
    }

    LazyColumn(
        Modifier.fillMaxSize().background(BgPrimary),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {

        // ── Header ────────────────────────────────────────────────────────────
        item {
            Row(
                Modifier.fillMaxWidth().padding(bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("Journal", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                }
                // New entry button
                Box(
                    Modifier.clip(RoundedCornerShape(14.dp))
                        .background(AccentViolet)
                        .clickable(onClick = onNewEntry)
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        Icon(Icons.Filled.Edit, null, tint = Color.White, modifier = Modifier.size(14.dp))
                        Text(
                            if (hasTodayEntry) "TODAY" else "NEW",
                            fontSize = 10.sp, letterSpacing = 1.5.sp, color = Color.White, fontWeight = FontWeight.ExtraBold,
                        )
                    }
                }
            }
        }

        // ── Streak + 7-day mood strip ─────────────────────────────────────────
        item {
            Column(
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(BgCard)
                    .border(1.dp, BorderDefault, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Writing streak", fontSize = 11.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("🔥", fontSize = 22.sp)
                            Text("$streak", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = AccentViolet)
                            Text(if (streak == 1) "day" else "days", fontSize = 13.sp, color = TextMuted)
                        }
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("${entries.size}", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = AccentViolet)
                        Text("total entries", fontSize = 10.sp, color = TextMuted)
                    }
                }

                // 7-day mood calendar
                if (weekMoods.isNotEmpty()) {
                    HorizontalDivider(color = BorderSubtle)
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        weekMoods.forEachIndexed { idx, (date, day, mood) ->
                            val isToday = date == today
                            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    day, fontSize = 9.sp, letterSpacing = 0.5.sp,
                                    color = if (isToday) AccentViolet else TextSubtle,
                                    fontWeight = if (isToday) FontWeight.ExtraBold else FontWeight.Normal,
                                )
                                Box(
                                    Modifier.size(32.dp)
                                        .clip(CircleShape)
                                        .background(
                                            when {
                                                mood.isNotBlank() -> AccentViolet.copy(0.12f)
                                                isToday           -> AccentViolet.copy(0.06f)
                                                else              -> BgCardAlt
                                            }
                                        )
                                        .then(if (isToday) Modifier.border(1.dp, AccentViolet.copy(0.4f), CircleShape) else Modifier),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    if (mood.isNotBlank()) Text(mood, fontSize = 14.sp)
                                    else if (isToday) Box(Modifier.size(6.dp).clip(CircleShape).background(AccentViolet.copy(0.4f)))
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── AI Prompt card ────────────────────────────────────────────────────
        item {
            Column(
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(BgCard)
                    .border(1.dp, BorderDefault, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("✨", fontSize = 16.sp)
                    Spacer(Modifier.width(6.dp))
                    Text("Today's prompt", fontSize = 11.sp, color = TextMuted, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    IconButton(
                        onClick = vm::loadPrompt,
                        modifier = Modifier.size(28.dp),
                        enabled = !loading,
                    ) {
                        if (loading) CircularProgressIndicator(modifier = Modifier.size(14.dp), color = AccentCyan, strokeWidth = 1.5.dp)
                        else Icon(Icons.Filled.Refresh, null, tint = AccentCyan, modifier = Modifier.size(16.dp))
                    }
                }
                HorizontalDivider(color = BorderSubtle)
                if (prompt.isNotBlank()) {
                    Text(
                        "\"$prompt\"",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextPrimary,
                        lineHeight = 22.sp,
                    )
                    Box(
                        Modifier.clip(RoundedCornerShape(10.dp))
                            .background(AccentBlue)
                            .clickable(onClick = onNewEntry)
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                    ) {
                        Text("Write now →", fontSize = 12.sp, color = Color.White, fontWeight = FontWeight.Medium)
                    }
                } else if (loading) {
                    Text("Generating your prompt…", style = MaterialTheme.typography.bodySmall, color = TextSubtle)
                }
            }
        }

        // ── Entry list grouped by month ───────────────────────────────────────
        if (grouped.isEmpty()) {
            item {
                Box(
                    Modifier.fillMaxWidth().padding(top = 32.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("📖", fontSize = 40.sp)
                        Text("No entries yet", fontSize = 14.sp, color = TextMuted, fontWeight = FontWeight.Medium)
                        Text("Start with today's prompt above", style = MaterialTheme.typography.bodySmall, color = TextSubtle)
                    }
                }
            }
        } else {
            grouped.forEach { (month, monthEntries) ->
                item {
                    Text(
                        month,
                        fontSize = 11.sp,
                        color = TextMuted, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 4.dp, bottom = 2.dp),
                    )
                }
                items(monthEntries) { entry ->
                    JournalEntryCard(
                        entry     = entry,
                        onClick   = { onEntryClick(entry.id) },
                        onDelete  = { vm.deleteEntry(entry) },
                    )
                }
            }
        }

        item { Spacer(Modifier.height(80.dp)) }
    }
}

@Composable
private fun JournalEntryCard(entry: JournalEntry, onClick: () -> Unit, onDelete: () -> Unit) {
    var showDelete by remember { mutableStateOf(false) }

    val dayLabel = runCatching {
        LocalDate.parse(entry.date).format(DAY_FMT)
    }.getOrDefault(entry.date)

    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(BgCard)
            .border(1.dp, BorderDefault, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .height(IntrinsicSize.Min),
    ) {
        // Left accent stripe
        Box(Modifier.width(3.dp).fillMaxHeight().background(AccentViolet.copy(0.5f)))

        Column(
            Modifier.weight(1f).padding(horizontal = 12.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (entry.mood.isNotBlank()) {
                    Text(entry.mood, fontSize = 18.sp)
                    Spacer(Modifier.width(8.dp))
                }
                Column(Modifier.weight(1f)) {
                    Text(dayLabel, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                    if (entry.moodLabel.isNotBlank()) {
                        Text(entry.moodLabel, fontSize = 10.sp, color = NeonPurple.copy(0.7f), fontWeight = FontWeight.Medium)
                    }
                }
                // Word count chip
                Box(
                    Modifier.clip(RoundedCornerShape(6.dp))
                        .background(NeonPurple.copy(0.08f))
                        .border(1.dp, NeonPurple.copy(0.25f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 7.dp, vertical = 3.dp),
                ) {
                    Text("${entry.wordCount}w", fontSize = 9.sp, color = NeonPurple.copy(0.8f), fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(4.dp))
                IconButton(onClick = { showDelete = !showDelete }, Modifier.size(24.dp)) {
                    Icon(Icons.Filled.MoreVert, null, tint = TextSubtle.copy(0.5f), modifier = Modifier.size(14.dp))
                }
            }

            if (entry.content.isNotBlank()) {
                Text(
                    entry.content.take(120),
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 18.sp,
                )
            }

            // AI reflection indicator
            if (entry.aiReflection.isNotBlank()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text("✨", fontSize = 9.sp)
                    Text("AI reflection saved", fontSize = 9.sp, color = NeonCyan.copy(0.6f))
                }
            }
        }
    }

    if (showDelete) {
        AlertDialog(
            onDismissRequest = { showDelete = false },
            containerColor   = BgCard,
            shape            = RoundedCornerShape(18.dp),
            title = { Text("Delete entry?", fontSize = 14.sp, color = TextPrimary, fontWeight = FontWeight.Bold) },
            text  = { Text("This journal entry will be permanently deleted.", style = MaterialTheme.typography.bodySmall, color = TextMuted) },
            confirmButton = {
                Box(
                    Modifier.clip(RoundedCornerShape(8.dp)).background(AccentRed.copy(0.15f))
                        .border(1.dp, AccentRed.copy(0.5f), RoundedCornerShape(8.dp))
                        .clickable { onDelete(); showDelete = false }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                ) { Text("DELETE", fontSize = 10.sp, letterSpacing = 1.sp, color = AccentRed, fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { showDelete = false }) {
                    Text("CANCEL", fontSize = 10.sp, letterSpacing = 1.sp, color = TextMuted)
                }
            },
        )
    }
}
