package ro.b4it.homer.ui.screens.lifegoals

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
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.LifeGoal
import ro.b4it.homer.ui.theme.*

@Composable
fun LifeGoalsScreen(vm: LifeGoalsViewModel = hiltViewModel()) {
    val goals   by vm.goals.collectAsStateWithLifecycle(emptyList())
    var showAdd by remember { mutableStateOf(false) }

    val total      = goals.size
    val inProgress = goals.count { it.status == "active" && it.progress < 100 }
    val completed  = goals.count { it.progress >= 100 || it.status == "completed" }
    val rate       = if (total > 0) completed * 100 / total else 0

    LazyColumn(
        Modifier.fillMaxSize().background(BgPrimary),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // ── Header ──────────────────────────────────────────────────────────
        item {
            Row(Modifier.padding(top = 4.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("LIFE GOALS", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 3.sp, color = TextPrimary)
                    Box(Modifier.width(70.dp).height(2.dp).background(Brush.horizontalGradient(listOf(NeonPurple, NeonPink, NeonCyan))))
                }
                Box(
                    Modifier.clip(RoundedCornerShape(12.dp))
                        .background(NeonPurple.copy(0.1f))
                        .border(1.dp, NeonPurple.copy(0.55f), RoundedCornerShape(12.dp))
                        .clickable { showAdd = true }
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Filled.Add, null, tint = NeonPurple, modifier = Modifier.size(16.dp))
                        Text("NEW GOAL", fontSize = 9.sp, letterSpacing = 1.5.sp, color = NeonPurple, fontWeight = FontWeight.ExtraBold)
                    }
                }
            }
        }

        // ── Stats hero ──────────────────────────────────────────────────────
        item {
            Column(
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(BgCard)
                    .border(1.dp, Brush.linearGradient(listOf(NeonPurple.copy(0.5f), NeonPink.copy(0.3f), NeonCyan.copy(0.2f))), RoundedCornerShape(20.dp)),
            ) {
                Box(Modifier.fillMaxWidth().height(3.dp).background(Brush.horizontalGradient(listOf(NeonPurple, NeonPink, NeonCyan))))
                Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(
                        Triple(total.toString(),      "TOTAL",       NeonCyan),
                        Triple(inProgress.toString(), "ACTIVE",      NeonPink),
                        Triple(completed.toString(),  "COMPLETED",   AccentGreen),
                        Triple("$rate%",              "RATE",        NeonGold),
                    ).forEach { (value, label, color) ->
                        Column(
                            Modifier.weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(color.copy(0.07f))
                                .border(1.dp, color.copy(0.3f), RoundedCornerShape(12.dp))
                                .padding(vertical = 12.dp, horizontal = 2.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(3.dp),
                        ) {
                            Text(value, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = color)
                            Text(label, fontSize = 7.sp, letterSpacing = 1.2.sp, color = color.copy(0.6f), fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        if (goals.isEmpty()) {
            item {
                Box(Modifier.fillMaxWidth().padding(vertical = 60.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("🎯", fontSize = 52.sp)
                        Text("NO GOALS YET", fontSize = 10.sp, letterSpacing = 3.sp, color = NeonPurple.copy(0.6f), fontWeight = FontWeight.Bold)
                        Text("Set your first life goal to get started", color = TextMuted, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }

        items(goals) { goal ->
            GoalCard(
                goal              = goal,
                milestones        = vm.parseMilestones(goal.milestonesJson),
                onToggleComplete  = { vm.toggleComplete(goal) },
                onDelete          = { vm.deleteGoal(goal) },
                onAddMilestone    = { vm.addMilestone(goal, it) },
                onToggleMilestone = { vm.toggleMilestone(goal, it) },
                onDeleteMilestone = { vm.deleteMilestone(goal, it) },
            )
        }
    }

    if (showAdd) {
        AddGoalDialog(onAdd = vm::addGoal, onDismiss = { showAdd = false })
    }
}

// ── Goal card ─────────────────────────────────────────────────────────────────

@Composable
fun GoalCard(
    goal: LifeGoal,
    milestones: List<MilestoneDto>,
    onToggleComplete: () -> Unit,
    onDelete: () -> Unit,
    onAddMilestone: (String) -> Unit,
    onToggleMilestone: (String) -> Unit,
    onDeleteMilestone: (String) -> Unit,
) {
    val done    = goal.progress >= 100 || goal.status == "completed"
    val pct     = (goal.progress / 100f).coerceIn(0f, 1f)
    val accent1 = if (done) NeonCyan else NeonPurple
    val accent2 = if (done) NeonGold.copy(0.7f) else NeonPink

    var showMilestoneInput by remember { mutableStateOf(false) }
    var milestoneInput     by remember { mutableStateOf("") }

    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(BgCard)
            .border(1.dp, Brush.linearGradient(listOf(accent1.copy(if (done) 0.7f else 0.45f), accent2.copy(0.25f))), RoundedCornerShape(18.dp)),
    ) {
        // Neon top stripe
        Box(
            Modifier.fillMaxWidth().height(3.dp)
                .background(Brush.horizontalGradient(listOf(accent1, accent2)))
        )

        Column(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Header row — ring icon + title + badges
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                // Progress ring around goal icon
                Box(contentAlignment = Alignment.Center, modifier = Modifier.size(62.dp)) {
                    androidx.compose.foundation.Canvas(Modifier.size(62.dp)) {
                        val strokePx = 5.dp.toPx()
                        val sweep    = -360f * (1f - pct)
                        drawArc(
                            color = Color(0xFF110030),
                            startAngle = -90f, sweepAngle = 360f,
                            useCenter = false,
                            style = Stroke(strokePx, cap = StrokeCap.Round),
                        )
                        if (pct > 0f) {
                            drawArc(
                                color = accent1.copy(0.2f),
                                startAngle = -90f, sweepAngle = sweep,
                                useCenter = false,
                                style = Stroke(strokePx + 7.dp.toPx(), cap = StrokeCap.Round),
                            )
                            drawArc(
                                color = accent1,
                                startAngle = -90f, sweepAngle = sweep,
                                useCenter = false,
                                style = Stroke(strokePx, cap = StrokeCap.Round),
                            )
                        }
                    }
                    Box(
                        Modifier.size(46.dp).clip(RoundedCornerShape(13.dp))
                            .background(accent1.copy(0.1f))
                            .border(1.dp, accent1.copy(0.4f), RoundedCornerShape(13.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(goal.icon.ifBlank { "🎯" }, fontSize = 20.sp)
                    }
                }

                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(goal.title, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = TextPrimary, lineHeight = 20.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (goal.category.isNotBlank()) {
                            Box(
                                Modifier.clip(RoundedCornerShape(5.dp))
                                    .background(NeonPurple.copy(0.08f))
                                    .border(1.dp, NeonPurple.copy(0.3f), RoundedCornerShape(5.dp))
                                    .padding(horizontal = 8.dp, vertical = 2.dp),
                            ) {
                                Text(goal.category.uppercase(), fontSize = 7.sp, letterSpacing = 1.2.sp, color = NeonPurple.copy(0.85f), fontWeight = FontWeight.Bold)
                            }
                        }
                        if (done) {
                            Box(
                                Modifier.clip(RoundedCornerShape(5.dp))
                                    .background(NeonCyan.copy(0.1f))
                                    .border(1.dp, NeonCyan.copy(0.55f), RoundedCornerShape(5.dp))
                                    .padding(horizontal = 8.dp, vertical = 2.dp),
                            ) {
                                Text("✓ DONE", fontSize = 7.sp, letterSpacing = 1.sp, color = NeonCyan, fontWeight = FontWeight.ExtraBold)
                            }
                        }
                    }
                }
                IconButton(onClick = onDelete, Modifier.size(30.dp)) {
                    Icon(Icons.Filled.Delete, null, tint = TextSubtle.copy(0.4f), modifier = Modifier.size(14.dp))
                }
            }

            if (goal.description.isNotBlank()) {
                Text(goal.description, style = MaterialTheme.typography.bodySmall, color = TextMuted, lineHeight = 18.sp)
            }

            // Progress bar with percentage inline
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("PROGRESS", fontSize = 8.sp, letterSpacing = 2.sp, color = TextSubtle, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    Text("${goal.progress}%", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = accent1)
                }
                Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFF110030))) {
                    if (pct > 0f) {
                        Box(
                            Modifier.fillMaxWidth(pct).height(8.dp).clip(RoundedCornerShape(4.dp))
                                .background(Brush.horizontalGradient(listOf(accent1, accent2)))
                        )
                    }
                }
            }

            // Milestones
            if (milestones.isNotEmpty()) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(Brush.horizontalGradient(listOf(NeonPurple.copy(0.3f), Color.Transparent))))
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "MILESTONES  ${milestones.count { it.done }}/${milestones.size}",
                            fontSize = 8.sp,
                            letterSpacing = 2.sp,
                            color = NeonPurple.copy(0.65f),
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    milestones.forEach { ms ->
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = ms.done,
                                onCheckedChange = { onToggleMilestone(ms.id) },
                                modifier = Modifier.size(32.dp),
                                colors = CheckboxDefaults.colors(
                                    checkedColor   = NeonCyan,
                                    uncheckedColor = NeonPurple.copy(0.5f),
                                    checkmarkColor = BgCard,
                                ),
                            )
                            Text(
                                ms.text,
                                style = MaterialTheme.typography.bodySmall,
                                color = if (ms.done) TextSubtle else TextPrimary,
                                modifier = Modifier.weight(1f),
                            )
                            IconButton(onClick = { onDeleteMilestone(ms.id) }, Modifier.size(28.dp)) {
                                Icon(Icons.Filled.Close, null, tint = TextSubtle.copy(0.4f), modifier = Modifier.size(13.dp))
                            }
                        }
                    }
                }
            }

            if (showMilestoneInput) {
                Row(
                    Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    OutlinedTextField(
                        value = milestoneInput, onValueChange = { milestoneInput = it },
                        placeholder = { Text("New milestone…", color = TextSubtle, style = MaterialTheme.typography.bodySmall) },
                        singleLine = true, modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor   = NeonPurple,
                            unfocusedBorderColor = NeonPurple.copy(0.3f),
                            focusedTextColor     = TextPrimary,
                            unfocusedTextColor   = TextPrimary,
                            cursorColor          = NeonPurple,
                        ),
                    )
                    IconButton(onClick = { onAddMilestone(milestoneInput); milestoneInput = ""; showMilestoneInput = false }, Modifier.size(40.dp)) {
                        Icon(Icons.Filled.Check, null, tint = NeonCyan)
                    }
                    IconButton(onClick = { showMilestoneInput = false; milestoneInput = "" }, Modifier.size(40.dp)) {
                        Icon(Icons.Filled.Close, null, tint = TextSubtle)
                    }
                }
            }

            // Footer
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (goal.targetDate.isNotBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Filled.CalendarToday, null, tint = NeonPurple.copy(0.6f), modifier = Modifier.size(11.dp))
                        Text(goal.targetDate, fontSize = 11.sp, color = NeonPurple.copy(0.7f), fontWeight = FontWeight.SemiBold)
                    }
                }
                Spacer(Modifier.weight(1f))
                if (!showMilestoneInput) {
                    Box(
                        Modifier.clip(RoundedCornerShape(20.dp))
                            .border(1.dp, NeonPurple.copy(0.35f), RoundedCornerShape(20.dp))
                            .clickable { showMilestoneInput = true }
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                            Icon(Icons.Filled.Add, null, tint = NeonPurple.copy(0.65f), modifier = Modifier.size(11.dp))
                            Text("MILESTONE", fontSize = 8.sp, letterSpacing = 1.sp, color = NeonPurple.copy(0.65f), fontWeight = FontWeight.Bold)
                        }
                    }
                    Spacer(Modifier.width(8.dp))
                }
                val actionColor = if (done) NeonPink else NeonCyan
                Box(
                    Modifier.clip(RoundedCornerShape(20.dp))
                        .background(actionColor.copy(0.08f))
                        .border(1.dp, actionColor.copy(0.5f), RoundedCornerShape(20.dp))
                        .clickable(onClick = onToggleComplete)
                        .padding(horizontal = 14.dp, vertical = 7.dp),
                ) {
                    Text(
                        if (done) "MARK ACTIVE" else "COMPLETE",
                        fontSize = 9.sp,
                        letterSpacing = 1.sp,
                        color = actionColor,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }
            }
        }
    }
}

// ── Add goal dialog ───────────────────────────────────────────────────────────

@Composable
fun AddGoalDialog(onAdd: (String, String, String, String, String) -> Unit, onDismiss: () -> Unit) {
    var title  by remember { mutableStateOf("") }
    var desc   by remember { mutableStateOf("") }
    var cat    by remember { mutableStateOf("") }
    var icon   by remember { mutableStateOf("") }
    var target by remember { mutableStateOf("") }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor   = NeonPurple,
        unfocusedBorderColor = NeonPurple.copy(0.3f),
        focusedTextColor     = TextPrimary,
        unfocusedTextColor   = TextPrimary,
        focusedLabelColor    = NeonPurple,
        cursorColor          = NeonPurple,
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor   = BgCard,
        shape            = RoundedCornerShape(20.dp),
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("NEW LIFE GOAL", fontSize = 13.sp, letterSpacing = 2.sp, color = NeonPurple, fontWeight = FontWeight.ExtraBold)
                Box(Modifier.width(50.dp).height(1.5.dp).background(Brush.horizontalGradient(listOf(NeonPurple, NeonPink, NeonCyan))))
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple("Title *",                  title,  { v: String -> title  = v }),
                    Triple("Description",              desc,   { v: String -> desc   = v }),
                    Triple("Category",                 cat,    { v: String -> cat    = v }),
                    Triple("Icon (emoji)",             icon,   { v: String -> icon   = v }),
                    Triple("Target date (YYYY-MM-DD)", target, { v: String -> target = v }),
                ).forEach { (label, value, setter) ->
                    OutlinedTextField(value = value, onValueChange = setter, label = { Text(label, fontSize = 12.sp) },
                        singleLine = true, modifier = Modifier.fillMaxWidth(), colors = fieldColors)
                }
            }
        },
        confirmButton = {
            Box(
                Modifier.clip(RoundedCornerShape(10.dp))
                    .background(Brush.linearGradient(listOf(NeonPurple, NeonPink)))
                    .clickable { if (title.isNotBlank()) onAdd(title, desc, cat, icon, target) }
                    .padding(horizontal = 22.dp, vertical = 10.dp),
            ) { Text("ADD", fontSize = 11.sp, letterSpacing = 1.5.sp, color = Color.White, fontWeight = FontWeight.ExtraBold) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("CANCEL", fontSize = 10.sp, letterSpacing = 1.sp, color = TextMuted) }
        },
    )
}
