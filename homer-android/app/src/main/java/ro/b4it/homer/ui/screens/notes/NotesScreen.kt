package ro.b4it.homer.ui.screens.notes

import androidx.activity.compose.BackHandler
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.Note
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

    Column(Modifier.fillMaxSize().background(BgPrimary).imePadding()) {
        // ── Header ──────────────────────────────────────────────────────────
        Row(
            Modifier.fillMaxWidth().padding(start = 20.dp, top = 16.dp, end = 12.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Notes", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = TextPrimary, modifier = Modifier.weight(1f))
            Box(
                Modifier.size(38.dp).clip(RoundedCornerShape(10.dp))
                    .background(AccentBlue.copy(0.10f))
                    .border(1.dp, AccentBlue.copy(0.25f), RoundedCornerShape(10.dp))
                    .clickable { vm.newPage() },
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Filled.Add, null, tint = AccentBlue, modifier = Modifier.size(20.dp)) }
        }

        // ── Search bar ──────────────────────────────────────────────────────
        Row(
            Modifier.fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(BgCard)
                .border(1.dp, BorderDefault, RoundedCornerShape(12.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(Icons.Filled.Search, null, tint = TextSubtle, modifier = Modifier.size(18.dp))
            androidx.compose.foundation.text.BasicTextField(
                value = search,
                onValueChange = vm::setSearch,
                modifier = Modifier.weight(1f),
                textStyle = MaterialTheme.typography.bodyMedium.copy(color = TextPrimary),
                decorationBox = { inner ->
                    if (search.isEmpty()) Text("Search pages…", color = TextSubtle, style = MaterialTheme.typography.bodyMedium)
                    inner()
                },
                singleLine = true,
            )
            if (search.isNotEmpty()) {
                Icon(
                    Icons.Filled.Close, null, tint = TextSubtle, modifier = Modifier.size(16.dp).clickable { vm.setSearch("") }
                )
            }
        }

        Spacer(Modifier.height(8.dp))

        if (pages.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Box(
                        Modifier.size(80.dp).clip(RoundedCornerShape(22.dp))
                            .background(BgCardAlt)
                            .border(1.dp, BorderDefault, RoundedCornerShape(22.dp)),
                        contentAlignment = Alignment.Center,
                    ) { Text("📝", fontSize = 36.sp) }
                    Text("No pages yet", fontSize = 15.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                    Text("Create your first note to get started", color = TextMuted, style = MaterialTheme.typography.bodySmall)
                    Box(
                        Modifier.clip(RoundedCornerShape(10.dp))
                            .background(AccentBlue)
                            .clickable { vm.newPage() }
                            .padding(horizontal = 22.dp, vertical = 10.dp),
                    ) {
                        Text("New page", fontSize = 12.sp, color = Color.White, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // Pinned section
                val pinned = pages.filter { it.pinned }
                val rest   = pages.filter { !it.pinned }

                if (pinned.isNotEmpty()) {
                    item {
                        Text(
                            "Pinned", fontSize = 11.sp, letterSpacing = 0.sp,
                            color = TextMuted, fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(vertical = 6.dp),
                        )
                    }
                    items(pinned) { note ->
                        NotePageCard(note, onClick = { vm.openNote(note) }, onDelete = { vm.deleteNote(note) }, onPin = { vm.pinNote(note) })
                    }
                    if (rest.isNotEmpty()) {
                        item {
                            Text(
                                "All pages", fontSize = 11.sp, letterSpacing = 0.sp,
                                color = TextMuted, fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(top = 10.dp, bottom = 6.dp),
                            )
                        }
                    }
                }

                items(rest) { note ->
                    NotePageCard(note, onClick = { vm.openNote(note) }, onDelete = { vm.deleteNote(note) }, onPin = { vm.pinNote(note) })
                }

                item { Spacer(Modifier.height(16.dp)) }
            }
        }
    }
}

// ── Note page card ─────────────────────────────────────────────────────────────

@Composable
fun NotePageCard(note: Note, onClick: () -> Unit, onDelete: () -> Unit, onPin: () -> Unit) {
    val fmt      = SimpleDateFormat("MMM d, HH:mm", Locale.getDefault())
    val isPinned = note.pinned
    val accentColor = if (isPinned) AccentAmber else AccentBlue

    var showMenu by remember { mutableStateOf(false) }

    Row(
        Modifier.fillMaxWidth()
            .height(IntrinsicSize.Min)
            .clip(RoundedCornerShape(14.dp))
            .background(BgCard)
            .border(1.dp, BorderDefault, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick),
    ) {
        // Left accent stripe
        Box(Modifier.width(3.dp).fillMaxHeight().background(accentColor.copy(0.5f)))

        Row(
            Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Emoji badge
            Box(
                Modifier.size(44.dp).clip(RoundedCornerShape(12.dp))
                    .background(accentColor.copy(0.07f))
                    .border(1.dp, accentColor.copy(0.18f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(note.emoji.ifBlank { "📝" }, fontSize = 22.sp)
            }

            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    note.title.ifBlank { "Untitled" },
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 15.sp,
                    color = TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (note.content.isNotBlank()) {
                    Text(
                        note.content.lines().firstOrNull { it.isNotBlank() }?.take(80) ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        fmt.format(Date(note.updatedAt)),
                        fontSize = 10.sp,
                        color = TextSubtle,
                        fontFamily = FontFamily.Monospace,
                    )
                    if (isPinned) {
                        Box(
                            Modifier.clip(RoundedCornerShape(4.dp))
                                .background(AccentAmber.copy(0.10f))
                                .border(1.dp, AccentAmber.copy(0.25f), RoundedCornerShape(4.dp))
                                .padding(horizontal = 5.dp, vertical = 1.dp),
                        ) {
                            Text("Pinned", fontSize = 9.sp, color = AccentAmber, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }

            Box {
                IconButton(onClick = { showMenu = true }, Modifier.size(32.dp)) {
                    Icon(Icons.Filled.MoreVert, null, tint = TextSubtle, modifier = Modifier.size(16.dp))
                }
                DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }, containerColor = BgCard) {
                    DropdownMenuItem(
                        text = {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.PushPin, null, tint = AccentAmber, modifier = Modifier.size(14.dp))
                                Text(if (isPinned) "Unpin" else "Pin", style = MaterialTheme.typography.bodySmall, color = AccentAmber)
                            }
                        },
                        onClick = { onPin(); showMenu = false },
                    )
                    DropdownMenuItem(
                        text = {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.Delete, null, tint = AccentRed, modifier = Modifier.size(14.dp))
                                Text("Delete", style = MaterialTheme.typography.bodySmall, color = AccentRed)
                            }
                        },
                        onClick = { onDelete(); showMenu = false },
                    )
                }
            }
        }
    }
}

// ── Note editor ────────────────────────────────────────────────────────────────

@Composable
fun NoteEditorScreen(note: Note, content: String, vm: NotesViewModel) {
    var showEmojiInput by remember { mutableStateOf(false) }
    var titleState by remember(note.id) { mutableStateOf(note.title) }

    Column(Modifier.fillMaxSize().background(BgPrimary).imePadding()) {
        // ── Top bar ─────────────────────────────────────────────────────────
        Row(
            Modifier.fillMaxWidth()
                .background(BgCard)
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            IconButton(onClick = vm::closeNote, Modifier.size(36.dp)) {
                Icon(Icons.Filled.ArrowBack, null, tint = TextMuted)
            }

            // Emoji picker button
            Box(
                Modifier.size(38.dp).clip(RoundedCornerShape(10.dp))
                    .background(BgCardAlt)
                    .border(1.dp, BorderDefault, RoundedCornerShape(10.dp))
                    .clickable { showEmojiInput = !showEmojiInput },
                contentAlignment = Alignment.Center,
            ) { Text(note.emoji.ifBlank { "📝" }, fontSize = 20.sp) }

            // Title field
            androidx.compose.foundation.text.BasicTextField(
                value = titleState,
                onValueChange = { titleState = it; vm.setTitle(it) },
                modifier = Modifier.weight(1f),
                textStyle = MaterialTheme.typography.titleMedium.copy(
                    color = TextPrimary,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.5.sp,
                ),
                singleLine = true,
                decorationBox = { inner ->
                    if (titleState.isEmpty()) Text("Untitled", color = TextSubtle, style = MaterialTheme.typography.titleMedium)
                    inner()
                },
            )

            // Word count
            val wordCount = content.trim().split(Regex("\\s+")).count { it.isNotBlank() }
            Text("$wordCount w", fontSize = 10.sp, color = TextSubtle, fontFamily = FontFamily.Monospace)
        }

        // Emoji input row
        if (showEmojiInput) {
            Row(
                Modifier.fillMaxWidth()
                    .background(BgCard)
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = note.emoji,
                    onValueChange = vm::setEmoji,
                    label = { Text("Emoji", fontSize = 11.sp) },
                    singleLine = true,
                    modifier = Modifier.width(110.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor   = NeonCyan,
                        unfocusedBorderColor = NeonCyan.copy(0.3f),
                        focusedTextColor     = TextPrimary,
                        unfocusedTextColor   = TextPrimary,
                        focusedLabelColor    = NeonCyan,
                        cursorColor          = NeonCyan,
                    ),
                )
                Text("Pick any emoji for this page", style = MaterialTheme.typography.labelSmall, color = TextSubtle)
            }
        }

        // ── Formatting toolbar ───────────────────────────────────────────────
        FormattingToolbar(onFormat = { prefix, suffix ->
            val newContent = content + prefix + suffix
            vm.setEditContent(newContent)
        })

        HorizontalDivider(color = BorderDefault)

        // ── Editor area ──────────────────────────────────────────────────────
        androidx.compose.foundation.text.BasicTextField(
            value = content,
            onValueChange = vm::setEditContent,
            modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 16.dp),
            textStyle = MaterialTheme.typography.bodyMedium.copy(
                color = TextPrimary,
                lineHeight = 26.sp,
                letterSpacing = 0.2.sp,
            ),
            decorationBox = { inner ->
                if (content.isEmpty()) {
                    Text(
                        "Start writing…\n\nUse # for headings\n**bold**, *italic*, `code`\n- list items\n- [ ] tasks",
                        color = TextSubtle.copy(0.6f),
                        style = MaterialTheme.typography.bodyMedium,
                        lineHeight = 26.sp,
                    )
                }
                inner()
            },
        )
    }
}

// ── Formatting toolbar ────────────────────────────────────────────────────────

@Composable
fun FormattingToolbar(onFormat: (String, String) -> Unit) {
    val items = listOf(
        Triple("H1",  "# ", ""),
        Triple("H2",  "## ", ""),
        Triple("B",   "**", "**"),
        Triple("I",   "*", "*"),
        Triple("`",   "`", "`"),
        Triple("```", "```\n", "\n```"),
        Triple("—",   "- ", ""),
        Triple("☑",   "- [ ] ", ""),
        Triple("---", "\n---\n", ""),
    )
    Row(
        Modifier.fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .background(BgCard)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        items.forEach { (label, pre, suf) ->
            Box(
                Modifier.clip(RoundedCornerShape(6.dp))
                    .background(BgCardAlt)
                    .border(1.dp, BorderDefault, RoundedCornerShape(6.dp))
                    .clickable { onFormat(pre, suf) }
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(label, style = MaterialTheme.typography.labelSmall, color = TextMuted, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
