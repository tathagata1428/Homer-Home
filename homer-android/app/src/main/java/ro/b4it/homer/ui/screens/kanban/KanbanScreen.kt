package ro.b4it.homer.ui.screens.kanban

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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
import ro.b4it.homer.data.local.entity.KanbanProject
import ro.b4it.homer.data.local.entity.KanbanTask
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*

private val COLUMNS = listOf(
    Triple("todo",     "To Do",       AccentBlue),
    Triple("progress", "In Progress", AccentAmber),
    Triple("pending",  "Blocked",     AccentRed),
    Triple("done",     "Done",        AccentGreen),
)

@Composable
fun KanbanScreen(vm: KanbanViewModel = hiltViewModel()) {
    val projects   by vm.projects.collectAsStateWithLifecycle(emptyList())
    val selectedId by vm.selectedProjectId.collectAsStateWithLifecycle()
    val tasks      by vm.tasks.collectAsStateWithLifecycle(emptyList())
    var showAddProject by remember { mutableStateOf(false) }
    var showAddTask    by remember { mutableStateOf(false) }

    val selectedProject = projects.firstOrNull { it.id == selectedId }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        // Header
        Row(Modifier.fillMaxWidth().padding(16.dp, 12.dp), verticalAlignment = Alignment.CenterVertically) {
            if (selectedProject != null) {
                IconButton(onClick = { vm.selectProject(null) }) {
                    Icon(Icons.Filled.ArrowBack, null, tint = TextMuted)
                }
            }
            Text(
                selectedProject?.name ?: "Kanban",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = { if (selectedProject != null) showAddTask = true else showAddProject = true }) {
                Icon(Icons.Filled.Add, null, tint = AccentBlue)
            }
        }

        if (selectedProject == null) {
            // Project list
            if (projects.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("📋", fontSize = 40.sp)
                        Text("No projects yet", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                        TextButton(onClick = { showAddProject = true }) { Text("Create project", color = AccentBlue) }
                    }
                }
            } else {
                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(projects) { proj ->
                        ProjectCard(proj, onClick = { vm.selectProject(proj.id) }, onDelete = { vm.deleteProject(proj) })
                    }
                }
            }
        } else {
            // Board columns (horizontal scroll)
            Row(
                Modifier.fillMaxSize().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                COLUMNS.forEach { (col, label, color) ->
                    val colTasks = tasks.filter { it.column == col }
                    BoardColumn(
                        label = label, color = color,
                        tasks = colTasks,
                        onMoveTask = { task, target -> vm.moveTask(task, target) },
                        onDeleteTask = { vm.deleteTask(it) },
                    )
                }
            }
        }
    }

    if (showAddProject) {
        AddProjectDialog(onAdd = { n, k, d, ic, c -> vm.addProject(n, k, d, ic, c); showAddProject = false }, onDismiss = { showAddProject = false })
    }
    if (showAddTask) {
        AddTaskDialog(onAdd = { s, d, p -> vm.addTask(s, d, p); showAddTask = false }, onDismiss = { showAddTask = false })
    }
}

@Composable
private fun ProjectCard(project: KanbanProject, onClick: () -> Unit, onDelete: () -> Unit) {
    HomerCard {
        Row(
            Modifier.fillMaxWidth().clickable(onClick = onClick).padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.size(40.dp).clip(RoundedCornerShape(10.dp))
                    .background(AccentBlue.copy(0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(project.icon.ifBlank { "📋" }, fontSize = 20.sp)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(project.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                if (project.description.isNotBlank()) Text(project.description, style = MaterialTheme.typography.labelSmall, color = TextMuted)
            }
            IconButton(onClick = onDelete, Modifier.size(28.dp)) {
                Icon(Icons.Filled.Delete, null, tint = AccentRed.copy(0.6f), modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
private fun BoardColumn(
    label: String, color: Color,
    tasks: List<KanbanTask>,
    onMoveTask: (KanbanTask, String) -> Unit,
    onDeleteTask: (KanbanTask) -> Unit,
) {
    Column(
        Modifier.width(240.dp).fillMaxHeight().clip(RoundedCornerShape(12.dp)).background(BgCard).padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(8.dp).clip(RoundedCornerShape(4.dp)).background(color))
            Spacer(Modifier.width(6.dp))
            Text(label, style = MaterialTheme.typography.labelMedium, color = color, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            Text("${tasks.size}", style = MaterialTheme.typography.labelSmall, color = TextMuted)
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items(tasks) { task ->
                TaskCard(task, onMove = { onMoveTask(task, it) }, onDelete = { onDeleteTask(task) })
            }
        }
    }
}

@Composable
private fun TaskCard(task: KanbanTask, onMove: (String) -> Unit, onDelete: () -> Unit) {
    val priorityColor = when (task.priority) {
        "high"     -> AccentAmber
        "critical" -> AccentRed
        "low"      -> AccentGreen
        else       -> TextMuted
    }
    var showMenu by remember { mutableStateOf(false) }
    Box(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(BgCardAlt).padding(10.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(task.summary, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Box {
                    IconButton(onClick = { showMenu = true }, Modifier.size(20.dp)) {
                        Icon(Icons.Filled.MoreVert, null, tint = TextSubtle, modifier = Modifier.size(14.dp))
                    }
                    DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }, containerColor = BgCard) {
                        COLUMNS.forEach { (col, label, _) ->
                            if (col != task.column)
                                DropdownMenuItem(text = { Text("Move: $label") }, onClick = { onMove(col); showMenu = false })
                        }
                        DropdownMenuItem(text = { Text("Delete", color = AccentRed) }, onClick = { onDelete(); showMenu = false })
                    }
                }
            }
            if (task.description.isNotBlank()) Text(task.description, style = MaterialTheme.typography.labelSmall, color = TextMuted, maxLines = 2)
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.clip(RoundedCornerShape(4.dp)).background(priorityColor.copy(0.15f)).padding(horizontal = 6.dp, vertical = 2.dp)) {
                    Text(task.priority, style = MaterialTheme.typography.labelSmall, color = priorityColor)
                }
                if (task.dueDate.isNotBlank()) Text(task.dueDate, style = MaterialTheme.typography.labelSmall, color = TextSubtle)
            }
        }
    }
}

@Composable
private fun AddProjectDialog(onAdd: (String, String, String, String, String) -> Unit, onDismiss: () -> Unit) {
    var name  by remember { mutableStateOf("") }
    var key   by remember { mutableStateOf("") }
    var desc  by remember { mutableStateOf("") }
    var icon  by remember { mutableStateOf("") }
    var color by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, containerColor = BgCard, title = { Text("New Project") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple("Name *", name, { v: String -> name = v }),
                    Triple("Key (e.g. PROJ)", key, { v: String -> key = v }),
                    Triple("Description", desc, { v: String -> desc = v }),
                    Triple("Icon (emoji)", icon, { v: String -> icon = v }),
                    Triple("Color (#hex)", color, { v: String -> color = v }),
                ).forEach { (lbl, value, setter) ->
                    OutlinedTextField(value = value, onValueChange = setter, label = { Text(lbl) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedLabelColor = AccentBlue))
                }
            }
        },
        confirmButton = { TextButton(onClick = { if (name.isNotBlank()) onAdd(name, key, desc, icon, color) }) { Text("Create", color = AccentBlue) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } })
}

@Composable
private fun AddTaskDialog(onAdd: (String, String, String) -> Unit, onDismiss: () -> Unit) {
    var summary  by remember { mutableStateOf("") }
    var desc     by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf("medium") }
    AlertDialog(onDismissRequest = onDismiss, containerColor = BgCard, title = { Text("New Task") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = summary, onValueChange = { summary = it }, label = { Text("Summary *") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedLabelColor = AccentBlue))
                OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedLabelColor = AccentBlue))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Priority:", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    listOf("low", "medium", "high", "critical").forEach { p ->
                        FilterChip(selected = priority == p, onClick = { priority = p }, label = { Text(p) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = AccentBlue.copy(0.2f), selectedLabelColor = AccentBlue))
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = { if (summary.isNotBlank()) onAdd(summary, desc, priority) }) { Text("Add", color = AccentBlue) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } })
}
