package ro.b4it.homer.ui.screens.notes

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.Note
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun NotesScreen(vm: NotesViewModel = hiltViewModel()) {
    val editing by vm.editing.collectAsStateWithLifecycle()
    val content by vm.editContent.collectAsStateWithLifecycle()
    val pages   by vm.pages.collectAsStateWithLifecycle(emptyList())
    val search  by vm.search.collectAsStateWithLifecycle()

    if (editing != null) {
        BackHandler { vm.closeNote() }
        NoteEditorScreen(note = editing!!, content = content, vm = vm)
        return
    }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        // Header
        Row(Modifier.fillMaxWidth().padding(16.dp, 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Notes", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            IconButton(onClick = vm::newPage) { Icon(Icons.Filled.Add, null, tint = AccentBlue) }
        }

        // Search
        OutlinedTextField(
            value = search, onValueChange = vm::setSearch,
            placeholder = { Text("Search pages…", color = TextSubtle) },
            leadingIcon = { Icon(Icons.Filled.Search, null, tint = TextMuted) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary),
        )
        Spacer(Modifier.height(8.dp))

        if (pages.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("📝", fontSize = 40.sp)
                    Text("No pages yet", style = MaterialTheme.typography.bodyMedium, color = TextMuted)
                    TextButton(onClick = vm::newPage) { Text("Create your first page", color = AccentBlue) }
                }
            }
        } else {
            LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(pages) { note ->
                    NotePageCard(note = note, onClick = { vm.openNote(note) }, onDelete = { vm.deleteNote(note) }, onPin = { vm.pinNote(note) })
                }
            }
        }
    }
}

@Composable
fun NotePageCard(note: Note, onClick: () -> Unit, onDelete: () -> Unit, onPin: () -> Unit) {
    val fmt = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
    HomerCard {
        Row(
            Modifier.fillMaxWidth().clickable(onClick = onClick).padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(note.emoji.ifBlank { "📝" }, fontSize = 24.sp, modifier = Modifier.width(36.dp))
            Column(Modifier.weight(1f)) {
                Text(note.title.ifBlank { "Untitled" }, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (note.content.isNotBlank())
                    Text(note.content.lines().firstOrNull { it.isNotBlank() }?.take(80) ?: "", style = MaterialTheme.typography.bodySmall, color = TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(fmt.format(Date(note.updatedAt)), style = MaterialTheme.typography.labelSmall, color = TextSubtle)
            }
            if (note.pinned) Icon(Icons.Filled.PushPin, null, tint = AccentAmber, modifier = Modifier.size(16.dp).padding(end = 4.dp))
            var showMenu by remember { mutableStateOf(false) }
            Box {
                IconButton(onClick = { showMenu = true }, Modifier.size(28.dp)) {
                    Icon(Icons.Filled.MoreVert, null, tint = TextSubtle, modifier = Modifier.size(16.dp))
                }
                DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }, containerColor = BgCard) {
                    DropdownMenuItem(text = { Text(if (note.pinned) "Unpin" else "Pin") }, onClick = { onPin(); showMenu = false })
                    DropdownMenuItem(text = { Text("Delete", color = AccentRed) }, onClick = { onDelete(); showMenu = false })
                }
            }
        }
    }
}

@Composable
fun NoteEditorScreen(note: Note, content: String, vm: NotesViewModel) {
    var showEmojiInput by remember { mutableStateOf(false) }
    var titleState by remember(note.id) { mutableStateOf(note.title) }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        // Top bar
        Row(Modifier.fillMaxWidth().padding(8.dp, 4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = vm::closeNote) { Icon(Icons.Filled.ArrowBack, null, tint = TextMuted) }
            Box(
                Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(BgCardAlt)
                    .clickable { showEmojiInput = !showEmojiInput },
                contentAlignment = Alignment.Center,
            ) { Text(note.emoji.ifBlank { "📝" }, fontSize = 20.sp) }
            Spacer(Modifier.width(8.dp))
            BasicTextField(
                value = titleState,
                onValueChange = { titleState = it; vm.setTitle(it) },
                modifier = Modifier.weight(1f),
                textStyle = MaterialTheme.typography.titleMedium.copy(color = TextPrimary, fontWeight = FontWeight.SemiBold),
                decorationBox = { inner ->
                    if (titleState.isEmpty()) Text("Untitled", color = TextSubtle, style = MaterialTheme.typography.titleMedium)
                    inner()
                },
            )
        }

        if (showEmojiInput) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                OutlinedTextField(
                    value = note.emoji,
                    onValueChange = vm::setEmoji,
                    label = { Text("Emoji") }, singleLine = true,
                    modifier = Modifier.width(100.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedLabelColor = AccentBlue),
                )
            }
        }

        // Formatting toolbar
        FormattingToolbar(onFormat = { prefix, suffix ->
            // Minimal: insert markdown tags around "cursor" — content manipulation is simplified
            val newContent = content + prefix + suffix
            vm.setEditContent(newContent)
        })

        HorizontalDivider(color = BorderSubtle)

        // Editor
        BasicTextField(
            value = content,
            onValueChange = vm::setEditContent,
            modifier = Modifier.fillMaxSize().padding(16.dp),
            textStyle = MaterialTheme.typography.bodyMedium.copy(color = TextPrimary, lineHeight = 24.sp),
            decorationBox = { inner ->
                if (content.isEmpty()) Text("Start writing…\n\nUse # for headings, **bold**, *italic*, `code`", color = TextSubtle, style = MaterialTheme.typography.bodyMedium, lineHeight = 24.sp)
                inner()
            },
        )
    }
}

@Composable
fun FormattingToolbar(onFormat: (String, String) -> Unit) {
    val items = listOf(
        Triple("H1", "# ", ""),
        Triple("H2", "## ", ""),
        Triple("B", "**", "**"),
        Triple("I", "*", "*"),
        Triple("`", "`", "`"),
        Triple("```", "```\n", "\n```"),
        Triple("- ", "- ", ""),
        Triple("[ ]", "- [ ] ", ""),
    )
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
            .background(BgCard).padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        items.forEach { (label, pre, suf) ->
            Box(
                Modifier.clip(RoundedCornerShape(6.dp)).background(BgCardAlt)
                    .clickable { onFormat(pre, suf) }.padding(horizontal = 10.dp, vertical = 5.dp),
            ) { Text(label, style = MaterialTheme.typography.labelSmall, color = TextMuted, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun BasicTextField(
    value: String, onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    textStyle: androidx.compose.ui.text.TextStyle = MaterialTheme.typography.bodyMedium.copy(color = TextPrimary),
    decorationBox: @Composable (@Composable () -> Unit) -> Unit = { it() },
) {
    androidx.compose.foundation.text.BasicTextField(
        value = value, onValueChange = onValueChange,
        modifier = modifier, textStyle = textStyle, decorationBox = decorationBox,
    )
}
