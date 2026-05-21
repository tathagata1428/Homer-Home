package ro.b4it.homer.ui.screens.kanban

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.theme.*

private val PRIORITIES = listOf("low", "medium", "high", "critical")
private val COLUMNS    = listOf(
    "todo"     to "To Do",
    "progress" to "In Progress",
    "pending"  to "Blocked",
    "done"     to "Done",
)

@Composable
fun KanbanTaskDetailScreen(
    onBack: () -> Unit,
    vm: KanbanTaskDetailViewModel = hiltViewModel(),
) {
    val task  by vm.task.collectAsStateWithLifecycle()
    val saved by vm.saved.collectAsStateWithLifecycle()

    LaunchedEffect(saved) { if (saved) onBack() }

    val t = task
    if (t == null) {
        Box(Modifier.fillMaxSize().background(BgPrimary), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = NeonPink)
        }
        return
    }

    var summary      by remember(t.id) { mutableStateOf(t.summary) }
    var desc         by remember(t.id) { mutableStateOf(t.description) }
    var priority     by remember(t.id) { mutableStateOf(t.priority) }
    var dueDate      by remember(t.id) { mutableStateOf(t.dueDate) }
    var assignee     by remember(t.id) { mutableStateOf(t.assignee) }
    var column       by remember(t.id) { mutableStateOf(t.column) }
    var subtaskInput by remember { mutableStateOf("") }

    val subtasks = vm.parseSubtasks(t.subtasksJson)

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor   = NeonPink,
        unfocusedBorderColor = NeonPink.copy(0.3f),
        focusedTextColor     = TextPrimary,
        unfocusedTextColor   = TextPrimary,
        focusedLabelColor    = NeonPink,
        cursorColor          = NeonPink,
    )
    val cyanColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor   = NeonCyan,
        unfocusedBorderColor = NeonCyan.copy(0.3f),
        focusedTextColor     = TextPrimary,
        unfocusedTextColor   = TextPrimary,
        focusedLabelColor    = NeonCyan,
        cursorColor          = NeonCyan,
    )

    Column(Modifier.fillMaxSize().background(BgPrimary).imePadding()) {

        // ── Header bar ───────────────────────────────────────────────────────
        Row(
            Modifier.fillMaxWidth().padding(start = 4.dp, top = 8.dp, end = 12.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, null, tint = TextMuted) }
            Text("Task detail", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary, modifier = Modifier.weight(1f))
            Box(
                Modifier.clip(RoundedCornerShape(10.dp))
                    .background(AccentBlue)
                    .clickable { vm.save(summary, desc, priority, dueDate, assignee, column) }
                    .padding(horizontal = 18.dp, vertical = 9.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("Save", fontSize = 13.sp, color = Color.White, fontWeight = FontWeight.SemiBold)
            }
        }
        HorizontalDivider(color = BorderDefault)

        // ── Scrollable body ──────────────────────────────────────────────────
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {

            // ── Summary ──────────────────────────────────────────────────────
            OutlinedTextField(
                value = summary, onValueChange = { summary = it },
                label = { Text("Summary *") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = fieldColors,
            )

            // ── Status ───────────────────────────────────────────────────────
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Status", fontSize = 11.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    COLUMNS.forEach { (col, label) ->
                        val colColor = when (col) {
                            "todo"     -> NeonCyan
                            "progress" -> NeonPink
                            "pending"  -> AccentRed
                            else       -> AccentGreen
                        }
                        val sel = column == col
                        Box(
                            Modifier.clip(RoundedCornerShape(8.dp))
                                .background(if (sel) colColor.copy(0.15f) else Color.Transparent)
                                .border(1.dp, if (sel) colColor else colColor.copy(0.25f), RoundedCornerShape(8.dp))
                                .clickable { column = col }
                                .padding(horizontal = 10.dp, vertical = 7.dp),
                        ) {
                            Text(
                                label.uppercase(), fontSize = 8.sp, letterSpacing = 0.8.sp,
                                color = if (sel) colColor else TextMuted,
                                fontWeight = if (sel) FontWeight.ExtraBold else FontWeight.Normal,
                            )
                        }
                    }
                }
            }

            // ── Priority ─────────────────────────────────────────────────────
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Priority", fontSize = 11.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PRIORITIES.forEach { p ->
                        val pColor = when (p) {
                            "critical" -> AccentRed
                            "high"     -> NeonPink
                            "low"      -> AccentGreen
                            else       -> NeonCyan
                        }
                        val sel = priority == p
                        Box(
                            Modifier.clip(RoundedCornerShape(8.dp))
                                .background(if (sel) pColor.copy(0.14f) else Color.Transparent)
                                .border(1.dp, if (sel) pColor else pColor.copy(0.25f), RoundedCornerShape(8.dp))
                                .clickable { priority = p }
                                .padding(horizontal = 10.dp, vertical = 7.dp),
                        ) {
                            Text(
                                p.uppercase(), fontSize = 8.sp, letterSpacing = 0.8.sp,
                                color = if (sel) pColor else TextMuted,
                                fontWeight = if (sel) FontWeight.ExtraBold else FontWeight.Normal,
                            )
                        }
                    }
                }
            }

            // ── Description ──────────────────────────────────────────────────
            OutlinedTextField(
                value = desc, onValueChange = { desc = it },
                label = { Text("Description") },
                minLines = 8,
                modifier = Modifier.fillMaxWidth(),
                colors = cyanColors,
                placeholder = { Text("Steps, acceptance criteria, context…", color = TextSubtle) },
            )

            // ── Due date + Assignee ───────────────────────────────────────────
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = dueDate, onValueChange = { dueDate = it },
                    label = { Text("Due (YYYY-MM-DD)", fontSize = 10.sp) },
                    singleLine = true, modifier = Modifier.weight(1f), colors = fieldColors,
                )
                OutlinedTextField(
                    value = assignee, onValueChange = { assignee = it },
                    label = { Text("Assignee", fontSize = 10.sp) },
                    singleLine = true, modifier = Modifier.weight(1f), colors = fieldColors,
                )
            }

            // ── Subtasks ──────────────────────────────────────────────────────
            Column(
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(BgCard)
                    .border(1.dp, BorderDefault, RoundedCornerShape(14.dp))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // Header with progress badge
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Subtasks", fontSize = 11.sp, color = TextMuted, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    if (subtasks.isNotEmpty()) {
                        Box(
                            Modifier.clip(RoundedCornerShape(12.dp))
                                .background(AccentBlue.copy(0.08f))
                                .border(1.dp, AccentBlue.copy(0.25f), RoundedCornerShape(12.dp))
                                .padding(horizontal = 8.dp, vertical = 2.dp),
                        ) {
                            Text("${subtasks.count { it.done }}/${subtasks.size}", fontSize = 10.sp, color = AccentBlue, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
                HorizontalDivider(color = BorderSubtle)

                if (subtasks.isEmpty()) {
                    Text(
                        "No subtasks yet — break this issue into smaller steps",
                        style = MaterialTheme.typography.bodySmall, color = TextSubtle,
                        modifier = Modifier.padding(vertical = 4.dp),
                    )
                }

                // Subtask list
                subtasks.forEach { sub ->
                    Row(
                        Modifier.fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(BgCardAlt)
                            .border(1.dp, if (sub.done) AccentGreen.copy(0.3f) else BorderSubtle, RoundedCornerShape(8.dp))
                            .padding(end = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(
                            checked = sub.done,
                            onCheckedChange = { vm.toggleSubtask(sub.id) },
                            modifier = Modifier.size(36.dp),
                            colors = CheckboxDefaults.colors(
                                checkedColor   = AccentGreen,
                                uncheckedColor = NeonCyan.copy(0.5f),
                                checkmarkColor = BgPrimary,
                            ),
                        )
                        Text(
                            sub.text,
                            style    = MaterialTheme.typography.bodySmall,
                            color    = if (sub.done) TextSubtle else TextPrimary,
                            modifier = Modifier.weight(1f),
                        )
                        IconButton(onClick = { vm.deleteSubtask(sub.id) }, Modifier.size(32.dp)) {
                            Icon(Icons.Filled.Close, null, tint = AccentRed.copy(0.5f), modifier = Modifier.size(14.dp))
                        }
                    }
                }

                // Always-visible add subtask row
                Row(
                    Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    OutlinedTextField(
                        value = subtaskInput,
                        onValueChange = { subtaskInput = it },
                        placeholder = {
                            Text("+ Add a subtask…", color = NeonCyan.copy(0.4f), style = MaterialTheme.typography.bodySmall)
                        },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor   = NeonCyan,
                            unfocusedBorderColor = NeonCyan.copy(0.2f),
                            focusedTextColor     = TextPrimary,
                            unfocusedTextColor   = TextPrimary,
                            cursorColor          = NeonCyan,
                        ),
                    )
                    Box(
                        Modifier.size(40.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (subtaskInput.isNotBlank()) NeonCyan.copy(0.15f) else BgCardAlt)
                            .border(1.dp, if (subtaskInput.isNotBlank()) NeonCyan else BorderSubtle, RoundedCornerShape(10.dp))
                            .clickable {
                                if (subtaskInput.isNotBlank()) {
                                    vm.addSubtask(subtaskInput)
                                    subtaskInput = ""
                                }
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Add, null,
                            tint = if (subtaskInput.isNotBlank()) NeonCyan else TextSubtle,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            }

            // ── Reporter ──────────────────────────────────────────────────────
            if (t.reporter.isNotBlank()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("REPORTER", fontSize = 8.sp, letterSpacing = 1.5.sp, color = TextSubtle, fontWeight = FontWeight.ExtraBold)
                    Text(t.reporter, style = MaterialTheme.typography.labelSmall, color = NeonPink.copy(0.7f))
                }
            }

            Spacer(Modifier.height(80.dp))
        }
    }
}
