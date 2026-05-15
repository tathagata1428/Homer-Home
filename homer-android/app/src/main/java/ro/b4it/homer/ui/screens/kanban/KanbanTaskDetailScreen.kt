package ro.b4it.homer.ui.screens.kanban

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
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
    val task   by vm.task.collectAsStateWithLifecycle()
    val saved  by vm.saved.collectAsStateWithLifecycle()

    // Navigate back when save completes
    LaunchedEffect(saved) { if (saved) onBack() }

    val t = task
    if (t == null) {
        Box(Modifier.fillMaxSize().background(BgPrimary), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = AccentBlue)
        }
        return
    }

    var summary  by remember(t.id) { mutableStateOf(t.summary) }
    var desc     by remember(t.id) { mutableStateOf(t.description) }
    var priority by remember(t.id) { mutableStateOf(t.priority) }
    var dueDate  by remember(t.id) { mutableStateOf(t.dueDate) }
    var assignee by remember(t.id) { mutableStateOf(t.assignee) }
    var column   by remember(t.id) { mutableStateOf(t.column) }

    val priorityColor = when (priority) {
        "high"     -> AccentAmber
        "critical" -> AccentRed
        "low"      -> AccentGreen
        else       -> AccentBlue
    }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        // Top bar
        Row(
            Modifier.fillMaxWidth().padding(4.dp, 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, null, tint = TextMuted) }
            Text(
                "Edit Task",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
                color = TextPrimary,
            )
            IconButton(onClick = { vm.save(summary, desc, priority, dueDate, assignee, column) }) {
                Icon(Icons.Filled.Check, null, tint = AccentBlue)
            }
        }

        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Summary
            OutlinedTextField(
                value = summary, onValueChange = { summary = it },
                label = { Text("Summary") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault,
                    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
                    focusedLabelColor = AccentBlue,
                ),
            )

            // Description
            OutlinedTextField(
                value = desc, onValueChange = { desc = it },
                label = { Text("Description") },
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault,
                    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
                    focusedLabelColor = AccentBlue,
                ),
            )

            // Priority
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Priority", style = MaterialTheme.typography.labelMedium, color = TextMuted, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PRIORITIES.forEach { p ->
                        val pColor = when (p) {
                            "high"     -> AccentAmber
                            "critical" -> AccentRed
                            "low"      -> AccentGreen
                            else       -> AccentBlue
                        }
                        FilterChip(
                            selected = priority == p,
                            onClick = { priority = p },
                            label = { Text(p, style = MaterialTheme.typography.labelSmall) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = pColor.copy(0.2f),
                                selectedLabelColor = pColor,
                            ),
                        )
                    }
                }
            }

            // Status / column
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Status", style = MaterialTheme.typography.labelMedium, color = TextMuted, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    COLUMNS.forEach { (col, label) ->
                        val colColor = when (col) {
                            "todo"     -> AccentBlue
                            "progress" -> AccentAmber
                            "pending"  -> AccentRed
                            else       -> AccentGreen
                        }
                        FilterChip(
                            selected = column == col,
                            onClick = { column = col },
                            label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = colColor.copy(0.2f),
                                selectedLabelColor = colColor,
                            ),
                        )
                    }
                }
            }

            // Due date
            OutlinedTextField(
                value = dueDate, onValueChange = { dueDate = it },
                label = { Text("Due Date (YYYY-MM-DD)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault,
                    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
                    focusedLabelColor = AccentBlue,
                ),
            )

            // Assignee
            OutlinedTextField(
                value = assignee, onValueChange = { assignee = it },
                label = { Text("Assignee") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault,
                    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
                    focusedLabelColor = AccentBlue,
                ),
            )

            // Read-only meta
            if (t.reporter.isNotBlank()) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Reporter:", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Text(t.reporter, style = MaterialTheme.typography.labelSmall, color = TextSubtle)
                }
            }

            // Priority stripe preview
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(BgCard).padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(Modifier.width(4.dp).height(36.dp).clip(RoundedCornerShape(2.dp)).background(priorityColor))
                Column {
                    Text(summary.ifBlank { "Task summary" }, style = MaterialTheme.typography.bodySmall, color = TextPrimary, fontWeight = FontWeight.SemiBold)
                    Text(COLUMNS.firstOrNull { it.first == column }?.second ?: column, style = MaterialTheme.typography.labelSmall, color = TextMuted)
                }
            }

            Spacer(Modifier.height(80.dp))
        }
    }
}
