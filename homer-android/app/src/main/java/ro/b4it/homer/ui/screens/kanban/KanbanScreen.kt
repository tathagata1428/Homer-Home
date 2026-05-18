package ro.b4it.homer.ui.screens.kanban

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
import ro.b4it.homer.data.local.entity.KanbanProject
import ro.b4it.homer.data.local.entity.KanbanTask
import ro.b4it.homer.ui.theme.*
import java.time.LocalDate

private val COLUMNS = listOf(
    Triple("todo",     "TO DO",       NeonCyan),
    Triple("progress", "IN PROGRESS", NeonPink),
    Triple("pending",  "BLOCKED",     AccentRed),
    Triple("done",     "DONE",        AccentGreen),
)

@Composable
fun KanbanScreen(
    onTaskClick: (String) -> Unit = {},
    vm: KanbanViewModel = hiltViewModel(),
) {
    val projects   by vm.projects.collectAsStateWithLifecycle(emptyList())
    val selectedId by vm.selectedProjectId.collectAsStateWithLifecycle()
    val tasks      by vm.tasks.collectAsStateWithLifecycle(emptyList())
    val allTasks   by vm.allTasks.collectAsStateWithLifecycle(emptyList())
    var showAddProject by remember { mutableStateOf(false) }
    var showAddTask    by remember { mutableStateOf(false) }

    val selectedProject = projects.firstOrNull { it.id == selectedId }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        // Header
        Row(
            Modifier.fillMaxWidth().padding(start = if (selectedProject != null) 4.dp else 16.dp, top = 12.dp, end = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (selectedProject != null) {
                IconButton(onClick = { vm.selectProject(null) }) {
                    Icon(Icons.Filled.ArrowBack, null, tint = NeonPink)
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(
                    (selectedProject?.name ?: "PROJECT HUB").uppercase(),
                    fontSize = if (selectedProject != null) 20.sp else 24.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = if (selectedProject != null) 1.sp else 3.sp,
                    color = TextPrimary,
                )
                Box(
                    Modifier
                        .width(if (selectedProject != null) 40.dp else 80.dp)
                        .height(2.dp)
                        .background(Brush.horizontalGradient(listOf(NeonPink, NeonCyan)))
                )
            }
            Box(
                Modifier.size(38.dp).clip(RoundedCornerShape(11.dp))
                    .background(NeonPink.copy(0.1f))
                    .border(1.dp, NeonPink.copy(0.5f), RoundedCornerShape(11.dp))
                    .clickable { if (selectedProject != null) showAddTask = true else showAddProject = true },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Add, null, tint = NeonPink, modifier = Modifier.size(20.dp))
            }
        }

        if (selectedProject == null) {
            if (projects.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(
                            Modifier.size(72.dp).clip(RoundedCornerShape(20.dp))
                                .background(NeonPink.copy(0.08f))
                                .border(1.dp, Brush.linearGradient(listOf(NeonPink.copy(0.5f), NeonCyan.copy(0.3f))), RoundedCornerShape(20.dp)),
                            contentAlignment = Alignment.Center,
                        ) { Text("📋", fontSize = 32.sp) }
                        Text("NO PROJECTS", fontSize = 12.sp, letterSpacing = 3.sp, color = NeonPink.copy(0.6f), fontWeight = FontWeight.ExtraBold)
                        Text("Create your first project to start tracking", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                        Box(
                            Modifier.clip(RoundedCornerShape(20.dp))
                                .background(Brush.linearGradient(listOf(NeonPink, NeonCyan)))
                                .clickable { showAddProject = true }
                                .padding(horizontal = 24.dp, vertical = 11.dp),
                        ) {
                            Text("NEW PROJECT", fontSize = 10.sp, letterSpacing = 2.sp, color = Color.White, fontWeight = FontWeight.ExtraBold)
                        }
                    }
                }
            } else {
                val today      = LocalDate.now().toString()
                val totalTasks = allTasks.size
                val doneTasks  = allTasks.count { it.column == "done" }
                val inProgress = allTasks.count { it.column == "progress" }
                val blocked    = allTasks.count { it.column == "pending" }
                val overdue    = allTasks.count { it.dueDate.isNotBlank() && it.dueDate < today && it.column != "done" }
                val donePct    = if (totalTasks > 0) doneTasks.toFloat() / totalTasks else 0f
                val healthPct  = if (totalTasks > 0) maxOf(0f, 1f - overdue.toFloat() / totalTasks) else 1f

                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    // ── Portfolio dashboard ──────────────────────────────────
                    if (totalTasks > 0) {
                        item {
                            Column(
                                Modifier.fillMaxWidth()
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(BgCard)
                                    .border(1.dp, Brush.linearGradient(listOf(NeonPink.copy(0.5f), NeonCyan.copy(0.3f))), RoundedCornerShape(18.dp))
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(16.dp),
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text("PORTFOLIO INTEL", fontSize = 9.sp, letterSpacing = 2.5.sp, color = NeonPink.copy(0.7f), fontWeight = FontWeight.Bold)
                                        Spacer(Modifier.height(2.dp))
                                        Text("${projects.size} Active Projects", fontSize = 14.sp, color = TextMuted)
                                    }
                                    Box(
                                        Modifier.clip(RoundedCornerShape(10.dp))
                                            .background(NeonCyan.copy(0.08f))
                                            .border(1.dp, NeonCyan.copy(0.4f), RoundedCornerShape(10.dp))
                                            .padding(horizontal = 10.dp, vertical = 5.dp),
                                    ) {
                                        Text("$totalTasks TASKS", fontSize = 9.sp, letterSpacing = 1.sp, color = NeonCyan, fontWeight = FontWeight.ExtraBold)
                                    }
                                }

                                // Stat chips
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    listOf(
                                        Triple(inProgress.toString(), "ACTIVE",   NeonPink),
                                        Triple(doneTasks.toString(),  "DONE",     AccentGreen),
                                        Triple(blocked.toString(),    "BLOCKED",  AccentRed),
                                        Triple(overdue.toString(),    "OVERDUE",  NeonGold),
                                    ).forEach { (value, label, color) ->
                                        Column(
                                            Modifier.weight(1f)
                                                .clip(RoundedCornerShape(12.dp))
                                                .background(color.copy(0.07f))
                                                .border(1.dp, color.copy(0.4f), RoundedCornerShape(12.dp))
                                                .padding(vertical = 10.dp, horizontal = 4.dp),
                                            horizontalAlignment = Alignment.CenterHorizontally,
                                            verticalArrangement = Arrangement.spacedBy(3.dp),
                                        ) {
                                            Text(value, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = color)
                                            Text(label, fontSize = 7.sp, letterSpacing = 1.2.sp, color = color.copy(0.65f), fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }

                                // Completion bar
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text("COMPLETION", fontSize = 8.sp, letterSpacing = 2.sp, color = TextSubtle, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                                        Text("${(donePct * 100).toInt()}%", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = AccentGreen)
                                    }
                                    Box(Modifier.fillMaxWidth().height(7.dp).clip(RoundedCornerShape(4.dp)).background(BgCardAlt)) {
                                        if (donePct > 0f) {
                                            Box(
                                                Modifier.fillMaxWidth(donePct).height(7.dp).clip(RoundedCornerShape(4.dp))
                                                    .background(Brush.horizontalGradient(listOf(NeonCyan, AccentGreen)))
                                            )
                                        }
                                    }
                                }

                                // Health bar
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text("DUE HEALTH", fontSize = 8.sp, letterSpacing = 2.sp, color = TextSubtle, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                                        Text(
                                            if (overdue == 0) "ON TRACK" else "$overdue OVERDUE",
                                            fontSize = 10.sp, letterSpacing = 1.sp, fontWeight = FontWeight.ExtraBold,
                                            color = if (overdue == 0) NeonCyan else AccentRed,
                                        )
                                    }
                                    Box(Modifier.fillMaxWidth().height(7.dp).clip(RoundedCornerShape(4.dp)).background(BgCardAlt)) {
                                        if (healthPct > 0f) {
                                            val hColor = if (overdue == 0) NeonCyan else if (healthPct > 0.7f) NeonGold else AccentRed
                                            Box(
                                                Modifier.fillMaxWidth(healthPct).height(7.dp).clip(RoundedCornerShape(4.dp))
                                                    .background(Brush.horizontalGradient(listOf(hColor.copy(0.6f), hColor)))
                                            )
                                        }
                                    }
                                }

                                if (blocked > 0) {
                                    Row(
                                        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                                            .background(AccentRed.copy(0.08f))
                                            .border(1.dp, AccentRed.copy(0.35f), RoundedCornerShape(10.dp))
                                            .padding(10.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    ) {
                                        Icon(Icons.Filled.Warning, null, tint = AccentRed, modifier = Modifier.size(14.dp))
                                        Text(
                                            "$blocked TASK${if (blocked > 1) "S" else ""} BLOCKED — NEEDS ATTENTION",
                                            fontSize = 9.sp, letterSpacing = 1.sp, color = AccentRed, fontWeight = FontWeight.Bold,
                                        )
                                    }
                                }
                            }
                        }
                    }

                    item {
                        Text(
                            "PROJECTS  (${projects.size})",
                            fontSize = 9.sp, letterSpacing = 2.sp, color = NeonPink.copy(0.65f), fontWeight = FontWeight.Bold,
                        )
                    }

                    items(projects) { proj ->
                        ProjectCard(proj, onClick = { vm.selectProject(proj.id) }, onDelete = { vm.deleteProject(proj) })
                    }
                }
            }
        } else {
            Row(
                Modifier.fillMaxSize()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                COLUMNS.forEach { (col, label, color) ->
                    val colTasks = tasks.filter { it.column == col }
                    BoardColumn(label, color, colTasks, onTaskClick, { task, target -> vm.moveTask(task, target) }, { vm.deleteTask(it) })
                }
            }
        }
    }

    if (showAddProject) {
        AddProjectDialog(onAdd = { n, k, d, ic, c -> vm.addProject(n, k, d, ic, c); showAddProject = false }, onDismiss = { showAddProject = false })
    }
    if (showAddTask) {
        AddTaskDialog(onAdd = { s, d, p, due -> vm.addTask(s, d, p, due); showAddTask = false }, onDismiss = { showAddTask = false })
    }
}

// ── Project card ──────────────────────────────────────────────────────────────

@Composable
private fun ProjectCard(project: KanbanProject, onClick: () -> Unit, onDelete: () -> Unit) {
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(BgCard)
            .border(1.dp, Brush.linearGradient(listOf(NeonPink.copy(0.4f), NeonCyan.copy(0.2f))), RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(
            Modifier.size(50.dp).clip(RoundedCornerShape(14.dp))
                .background(NeonPink.copy(0.08f))
                .border(1.dp, Brush.linearGradient(listOf(NeonPink.copy(0.5f), NeonCyan.copy(0.3f))), RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center,
        ) { Text(project.icon.ifBlank { "📋" }, fontSize = 22.sp) }

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(project.name, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = TextPrimary)
            if (project.key.isNotBlank()) {
                Box(
                    Modifier.clip(RoundedCornerShape(4.dp))
                        .background(NeonCyan.copy(0.07f))
                        .border(1.dp, NeonCyan.copy(0.3f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 7.dp, vertical = 2.dp),
                ) {
                    Text(project.key, fontSize = 9.sp, letterSpacing = 1.2.sp, color = NeonCyan.copy(0.85f), fontWeight = FontWeight.ExtraBold)
                }
            } else if (project.description.isNotBlank()) {
                Text(project.description, style = MaterialTheme.typography.bodySmall, color = TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        IconButton(onClick = onDelete, Modifier.size(32.dp)) {
            Icon(Icons.Filled.Delete, null, tint = AccentRed.copy(0.45f), modifier = Modifier.size(16.dp))
        }
        Icon(Icons.Filled.ChevronRight, null, tint = NeonPink.copy(0.5f), modifier = Modifier.size(20.dp))
    }
}

// ── Board column ──────────────────────────────────────────────────────────────

@Composable
private fun BoardColumn(
    label: String,
    color: Color,
    tasks: List<KanbanTask>,
    onTaskClick: (String) -> Unit,
    onMoveTask: (KanbanTask, String) -> Unit,
    onDeleteTask: (KanbanTask) -> Unit,
) {
    Column(
        Modifier
            .width(270.dp)
            .fillMaxHeight()
            .clip(RoundedCornerShape(16.dp))
            .background(BgCard)
            .border(1.dp, Brush.verticalGradient(listOf(color.copy(0.5f), color.copy(0.15f))), RoundedCornerShape(16.dp)),
    ) {
        // Neon top stripe
        Box(Modifier.fillMaxWidth().height(3.dp).background(Brush.horizontalGradient(listOf(color, color.copy(0.4f)))))

        // Column header
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(label, fontSize = 10.sp, letterSpacing = 1.5.sp, color = color, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
            Box(
                Modifier.clip(RoundedCornerShape(20.dp))
                    .background(color.copy(0.12f))
                    .border(1.dp, color.copy(0.4f), RoundedCornerShape(20.dp))
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            ) {
                Text("${tasks.size}", fontSize = 11.sp, color = color, fontWeight = FontWeight.ExtraBold)
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Brush.horizontalGradient(listOf(color.copy(0.2f), Color.Transparent))))

        LazyColumn(
            Modifier.padding(horizontal = 8.dp),
            contentPadding = PaddingValues(vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            items(tasks) { task ->
                TaskCard(task, onClick = { onTaskClick(task.id) }, onMove = { onMoveTask(task, it) }, onDelete = { onDeleteTask(task) })
            }
            if (tasks.isEmpty()) {
                item {
                    Box(Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
                        Text("EMPTY", fontSize = 8.sp, letterSpacing = 2.sp, color = color.copy(0.25f), fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// ── Task card ─────────────────────────────────────────────────────────────────

@Composable
private fun TaskCard(task: KanbanTask, onClick: () -> Unit, onMove: (String) -> Unit, onDelete: () -> Unit) {
    val priorityColor = when (task.priority) {
        "critical" -> AccentRed
        "high"     -> NeonPink
        "low"      -> AccentGreen
        else       -> NeonCyan.copy(0.8f)
    }
    var showMenu by remember { mutableStateOf(false) }
    val colIndex = COLUMNS.indexOfFirst { it.first == task.column }
    val prevCol  = if (colIndex > 0) COLUMNS[colIndex - 1] else null
    val nextCol  = if (colIndex < COLUMNS.size - 1) COLUMNS[colIndex + 1] else null

    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(BgCardAlt)
            .border(1.dp, priorityColor.copy(0.2f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .height(IntrinsicSize.Min),
    ) {
        Box(Modifier.width(3.dp).fillMaxHeight().background(Brush.verticalGradient(listOf(priorityColor, priorityColor.copy(0.4f)))))

        Column(
            Modifier.weight(1f).padding(horizontal = 10.dp, vertical = 9.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.Top) {
                Text(
                    task.summary,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Box {
                    IconButton(onClick = { showMenu = true }, Modifier.size(20.dp)) {
                        Icon(Icons.Filled.MoreVert, null, tint = NeonPink.copy(0.5f), modifier = Modifier.size(14.dp))
                    }
                    DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }, containerColor = BgCard) {
                        COLUMNS.forEach { (col, colLabel, _) ->
                            if (col != task.column) {
                                DropdownMenuItem(
                                    text    = { Text("→ $colLabel", style = MaterialTheme.typography.bodySmall) },
                                    onClick = { onMove(col); showMenu = false },
                                )
                            }
                        }
                        HorizontalDivider(color = BorderSubtle)
                        DropdownMenuItem(
                            text    = { Text("Delete", color = AccentRed, style = MaterialTheme.typography.bodySmall) },
                            onClick = { onDelete(); showMenu = false },
                        )
                    }
                }
            }

            if (task.description.isNotBlank()) {
                Text(task.description, style = MaterialTheme.typography.labelSmall, color = TextMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Row(
                    Modifier.clip(RoundedCornerShape(4.dp))
                        .background(priorityColor.copy(0.1f))
                        .border(1.dp, priorityColor.copy(0.35f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Box(Modifier.size(5.dp).clip(CircleShape).background(priorityColor))
                    Text(task.priority.uppercase(), fontSize = 7.sp, letterSpacing = 0.8.sp, color = priorityColor, fontWeight = FontWeight.ExtraBold)
                }
                if (task.dueDate.isNotBlank()) {
                    Spacer(Modifier.width(6.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        Icon(Icons.Filled.CalendarToday, null, tint = NeonCyan.copy(0.5f), modifier = Modifier.size(10.dp))
                        Text(task.dueDate, fontSize = 9.sp, color = NeonCyan.copy(0.6f))
                    }
                }
                Spacer(Modifier.weight(1f))
                // Quick-move arrows
                if (prevCol != null) {
                    Box(
                        Modifier.size(22.dp)
                            .clip(RoundedCornerShape(5.dp))
                            .background(prevCol.third.copy(0.08f))
                            .border(1.dp, prevCol.third.copy(0.3f), RoundedCornerShape(5.dp))
                            .clickable { onMove(prevCol.first) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Filled.KeyboardArrowLeft, null, tint = prevCol.third, modifier = Modifier.size(14.dp))
                    }
                    Spacer(Modifier.width(3.dp))
                }
                if (nextCol != null) {
                    Box(
                        Modifier.size(22.dp)
                            .clip(RoundedCornerShape(5.dp))
                            .background(nextCol.third.copy(0.08f))
                            .border(1.dp, nextCol.third.copy(0.3f), RoundedCornerShape(5.dp))
                            .clickable { onMove(nextCol.first) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Filled.KeyboardArrowRight, null, tint = nextCol.third, modifier = Modifier.size(14.dp))
                    }
                }
            }
        }
    }
}

// ── Dialogs ───────────────────────────────────────────────────────────────────

@Composable
private fun AddProjectDialog(onAdd: (String, String, String, String, String) -> Unit, onDismiss: () -> Unit) {
    var name  by remember { mutableStateOf("") }
    var key   by remember { mutableStateOf("") }
    var desc  by remember { mutableStateOf("") }
    var icon  by remember { mutableStateOf("") }
    var color by remember { mutableStateOf("") }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = NeonPink, unfocusedBorderColor = NeonPink.copy(0.3f),
        focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
        focusedLabelColor = NeonPink, cursorColor = NeonPink,
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = BgCard,
        shape = RoundedCornerShape(20.dp),
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("NEW PROJECT", fontSize = 13.sp, letterSpacing = 2.5.sp, color = NeonPink, fontWeight = FontWeight.ExtraBold)
                Box(Modifier.width(44.dp).height(1.5.dp).background(Brush.horizontalGradient(listOf(NeonPink, NeonCyan))))
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple("Name *",          name,  { v: String -> name  = v }),
                    Triple("Key (e.g. PROJ)", key,   { v: String -> key   = v }),
                    Triple("Description",     desc,  { v: String -> desc  = v }),
                    Triple("Icon (emoji)",    icon,  { v: String -> icon  = v }),
                    Triple("Color (#hex)",    color, { v: String -> color = v }),
                ).forEach { (lbl, value, setter) ->
                    OutlinedTextField(value = value, onValueChange = setter, label = { Text(lbl) },
                        singleLine = true, modifier = Modifier.fillMaxWidth(), colors = fieldColors)
                }
            }
        },
        confirmButton = {
            Box(
                Modifier.clip(RoundedCornerShape(10.dp))
                    .background(Brush.linearGradient(listOf(NeonPink, NeonCyan)))
                    .clickable { if (name.isNotBlank()) onAdd(name, key, desc, icon, color) }
                    .padding(horizontal = 22.dp, vertical = 10.dp),
            ) { Text("CREATE", fontSize = 11.sp, letterSpacing = 1.5.sp, color = Color.White, fontWeight = FontWeight.ExtraBold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("CANCEL", fontSize = 10.sp, letterSpacing = 1.sp, color = TextMuted) } },
    )
}

@Composable
private fun AddTaskDialog(onAdd: (String, String, String, String) -> Unit, onDismiss: () -> Unit) {
    var summary  by remember { mutableStateOf("") }
    var desc     by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf("medium") }
    var dueDate  by remember { mutableStateOf("") }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = NeonPink, unfocusedBorderColor = NeonPink.copy(0.3f),
        focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
        focusedLabelColor = NeonPink, cursorColor = NeonPink,
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = BgCard,
        shape = RoundedCornerShape(20.dp),
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("NEW TASK", fontSize = 13.sp, letterSpacing = 2.5.sp, color = NeonPink, fontWeight = FontWeight.ExtraBold)
                Box(Modifier.width(36.dp).height(1.5.dp).background(Brush.horizontalGradient(listOf(NeonPink, NeonCyan))))
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(value = summary, onValueChange = { summary = it }, label = { Text("Summary *") }, singleLine = true, modifier = Modifier.fillMaxWidth(), colors = fieldColors)
                OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth(), colors = fieldColors)
                OutlinedTextField(value = dueDate, onValueChange = { dueDate = it }, label = { Text("Due (YYYY-MM-DD)") }, singleLine = true, modifier = Modifier.fillMaxWidth(), colors = fieldColors)
                Text("PRIORITY", fontSize = 9.sp, letterSpacing = 2.sp, color = NeonPink.copy(0.65f), fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("low" to AccentGreen, "medium" to NeonCyan, "high" to NeonPink, "critical" to AccentRed).forEach { (p, pColor) ->
                        val sel = priority == p
                        Box(
                            Modifier.clip(RoundedCornerShape(8.dp))
                                .background(if (sel) pColor.copy(0.14f) else Color.Transparent)
                                .border(1.dp, if (sel) pColor.copy(0.8f) else pColor.copy(0.25f), RoundedCornerShape(8.dp))
                                .clickable { priority = p }
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                        ) {
                            Text(p.uppercase(), fontSize = 8.sp, letterSpacing = 0.8.sp, color = if (sel) pColor else TextMuted, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Box(
                Modifier.clip(RoundedCornerShape(10.dp))
                    .background(Brush.linearGradient(listOf(NeonPink, NeonCyan)))
                    .clickable { if (summary.isNotBlank()) onAdd(summary, desc, priority, dueDate) }
                    .padding(horizontal = 22.dp, vertical = 10.dp),
            ) { Text("ADD", fontSize = 11.sp, letterSpacing = 1.5.sp, color = Color.White, fontWeight = FontWeight.ExtraBold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("CANCEL", fontSize = 10.sp, letterSpacing = 1.sp, color = TextMuted) } },
    )
}
