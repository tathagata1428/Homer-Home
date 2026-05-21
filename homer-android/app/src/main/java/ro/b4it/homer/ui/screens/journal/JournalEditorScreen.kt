package ro.b4it.homer.ui.screens.journal

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Delete
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
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val HEADER_FMT = DateTimeFormatter.ofPattern("EEEE, d MMM yyyy", Locale.getDefault())

@Composable
fun JournalEditorScreen(
    onBack: () -> Unit,
    vm: JournalEditorViewModel = hiltViewModel(),
) {
    val entry              by vm.entry.collectAsStateWithLifecycle()
    val content            by vm.content.collectAsStateWithLifecycle()
    val mood               by vm.mood.collectAsStateWithLifecycle()
    val reflection         by vm.reflection.collectAsStateWithLifecycle()
    val reflectionLoading  by vm.reflectionLoading.collectAsStateWithLifecycle()
    val done               by vm.done.collectAsStateWithLifecycle()

    LaunchedEffect(done) { if (done) onBack() }

    var showDeleteConfirm by remember { mutableStateOf(false) }

    val dateLabel = remember(entry?.date) {
        runCatching {
            LocalDate.parse(entry?.date ?: LocalDate.now().toString()).format(HEADER_FMT)
        }.getOrDefault(entry?.date ?: "")
    }

    val wordCount = remember(content) {
        content.trim().split("\\s+".toRegex()).count { it.isNotBlank() }
    }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor   = NeonPurple,
        unfocusedBorderColor = NeonPurple.copy(0.25f),
        focusedTextColor     = TextPrimary,
        unfocusedTextColor   = TextPrimary.copy(0.9f),
        cursorColor          = NeonPurple,
        focusedLabelColor    = NeonPurple,
    )

    Column(Modifier.fillMaxSize().background(BgPrimary).imePadding()) {

        // ── Top bar ──────────────────────────────────────────────────────────
        Row(
            Modifier.fillMaxWidth().padding(start = 4.dp, top = 8.dp, end = 12.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Filled.ArrowBack, null, tint = NeonPurple)
            }
            Column(Modifier.weight(1f)) {
                Text(dateLabel, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                if (wordCount > 0) {
                    Text("$wordCount words", fontSize = 10.sp, color = NeonPurple.copy(0.6f))
                }
            }
            // Delete button
            if (entry?.content?.isNotBlank() == true) {
                IconButton(onClick = { showDeleteConfirm = true }, Modifier.size(36.dp)) {
                    Icon(Icons.Filled.Delete, null, tint = AccentRed.copy(0.5f), modifier = Modifier.size(18.dp))
                }
            }
            Spacer(Modifier.width(4.dp))
            // Save button
            Box(
                Modifier.clip(RoundedCornerShape(10.dp))
                    .background(AccentViolet)
                    .clickable(onClick = vm::save)
                    .padding(horizontal = 18.dp, vertical = 9.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("Save", fontSize = 10.sp, letterSpacing = 0.sp, color = Color.White, fontWeight = FontWeight.ExtraBold)
            }
        }
        HorizontalDivider(color = BorderSubtle)

        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {

            // ── Mood picker ─────────────────────────────────────────────────
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("How are you feeling?", fontSize = 11.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    MOODS.forEach { (emoji, label) ->
                        val selected = mood == emoji
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.clickable { vm.setMood(emoji, label) },
                        ) {
                            Box(
                                Modifier.size(44.dp)
                                    .clip(CircleShape)
                                    .background(if (selected) NeonPurple.copy(0.2f) else BgCard)
                                    .border(
                                        width  = if (selected) 2.dp else 1.dp,
                                        color  = if (selected) NeonPurple else BorderSubtle,
                                        shape  = CircleShape,
                                    ),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(emoji, fontSize = 20.sp)
                            }
                            Text(
                                label, fontSize = 8.sp, letterSpacing = 0.3.sp,
                                color = if (selected) NeonPurple else TextSubtle,
                                fontWeight = if (selected) FontWeight.ExtraBold else FontWeight.Normal,
                            )
                        }
                    }
                }
            }

            // ── Writing area ────────────────────────────────────────────────
            OutlinedTextField(
                value         = content,
                onValueChange = vm::setContent,
                placeholder   = {
                    Text(
                        "What's on your mind today?\n\nWrite freely — this is your private space...",
                        color = TextSubtle.copy(0.5f),
                        lineHeight = 22.sp,
                    )
                },
                minLines  = 12,
                modifier  = Modifier.fillMaxWidth(),
                colors    = fieldColors,
                textStyle = LocalTextStyle.current.copy(lineHeight = 24.sp, fontSize = 15.sp),
            )

            // ── AI Reflection button ─────────────────────────────────────────
            Box(
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (reflectionLoading) BgCard else BgCardAlt)
                    .border(1.dp, BorderDefault, RoundedCornerShape(12.dp))
                    .clickable(enabled = !reflectionLoading && content.length >= 20) {
                        vm.getReflection()
                    }
                    .padding(14.dp),
                contentAlignment = Alignment.Center,
            ) {
                if (reflectionLoading) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = NeonPurple, strokeWidth = 2.dp)
                        Text("Analyzing your entry…", fontSize = 12.sp, color = NeonPurple, fontWeight = FontWeight.Medium)
                    }
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Filled.AutoAwesome, null, tint = NeonPurple, modifier = Modifier.size(16.dp))
                        Text(
                            if (reflection != null) "Refresh AI Reflection" else "Get AI Reflection",
                            fontSize = 12.sp, color = NeonPurple, fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            if (content.length < 20) "(write more first)" else "",
                            fontSize = 10.sp, color = TextSubtle,
                        )
                    }
                }
            }

            // ── AI Reflection card ───────────────────────────────────────────
            AnimatedVisibility(
                visible = reflection != null,
                enter   = fadeIn() + expandVertically(),
                exit    = fadeOut() + shrinkVertically(),
            ) {
                reflection?.let { r ->
                    Column(
                        Modifier.fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(BgCard)
                            .border(1.dp, BorderDefault, RoundedCornerShape(14.dp))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        // Header
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("✨", fontSize = 14.sp)
                            Text("AI reflection", fontSize = 11.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                            if (r.mood.isNotBlank()) {
                                val moodEmoji = MOODS.firstOrNull { it.second == r.mood }?.first ?: ""
                                Box(
                                    Modifier.clip(RoundedCornerShape(20.dp))
                                        .background(NeonPurple.copy(0.12f))
                                        .border(1.dp, NeonPurple.copy(0.4f), RoundedCornerShape(20.dp))
                                        .padding(horizontal = 10.dp, vertical = 4.dp),
                                ) {
                                    Text("$moodEmoji  ${r.mood}", fontSize = 10.sp, color = NeonPurple, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                        HorizontalDivider(color = BorderSubtle)

                        // Themes
                        if (r.themes.isNotBlank()) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.horizontalScroll(rememberScrollState()),
                            ) {
                                Text("THEMES", fontSize = 7.sp, letterSpacing = 1.5.sp, color = TextSubtle, fontWeight = FontWeight.Bold)
                                r.themes.split(",").map { it.trim() }.filter { it.isNotBlank() }.forEach { theme ->
                                    Box(
                                        Modifier.clip(RoundedCornerShape(20.dp))
                                            .background(NeonCyan.copy(0.08f))
                                            .border(1.dp, NeonCyan.copy(0.3f), RoundedCornerShape(20.dp))
                                            .padding(horizontal = 8.dp, vertical = 3.dp),
                                    ) {
                                        Text(theme, fontSize = 9.sp, color = NeonCyan.copy(0.8f))
                                    }
                                }
                            }
                        }

                        // Insight
                        if (r.insight.isNotBlank()) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("INSIGHT", fontSize = 7.sp, letterSpacing = 1.5.sp, color = TextSubtle, fontWeight = FontWeight.Bold)
                                Text(
                                    r.insight,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextPrimary,
                                    lineHeight = 20.sp,
                                )
                            }
                        }

                        // Affirmation
                        if (r.affirmation.isNotBlank()) {
                            Row(
                                Modifier.fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(NeonPink.copy(0.06f))
                                    .border(1.dp, NeonPink.copy(0.2f), RoundedCornerShape(10.dp))
                                    .padding(12.dp),
                                verticalAlignment = Alignment.Top,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Text("✦", fontSize = 14.sp, color = NeonPink)
                                Text(
                                    r.affirmation,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = NeonPink.copy(0.9f),
                                    fontWeight = FontWeight.Medium,
                                    lineHeight = 20.sp,
                                    modifier = Modifier.weight(1f),
                                )
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(80.dp))
        }
    }

    // Delete confirmation
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            containerColor   = BgCard,
            shape            = RoundedCornerShape(18.dp),
            title = { Text("Delete this entry?", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text  = { Text("This journal entry will be permanently deleted. Your words cannot be recovered.", style = MaterialTheme.typography.bodySmall, color = TextMuted) },
            confirmButton = {
                Box(
                    Modifier.clip(RoundedCornerShape(8.dp)).background(AccentRed.copy(0.15f))
                        .border(1.dp, AccentRed.copy(0.5f), RoundedCornerShape(8.dp))
                        .clickable { vm.deleteEntry(); showDeleteConfirm = false }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                ) { Text("DELETE", fontSize = 10.sp, letterSpacing = 1.sp, color = AccentRed, fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("CANCEL", fontSize = 10.sp, color = TextMuted)
                }
            },
        )
    }
}
