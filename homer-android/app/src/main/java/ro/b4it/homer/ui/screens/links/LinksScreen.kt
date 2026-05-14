package ro.b4it.homer.ui.screens.links

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.Link
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*
import java.util.UUID

@Composable
fun LinksScreen(vm: LinksViewModel = hiltViewModel()) {
    val links  by vm.links.collectAsStateWithLifecycle(emptyList())
    var search by remember { mutableStateOf("") }
    var showAdd by remember { mutableStateOf(false) }
    val ctx = LocalContext.current

    val filtered = if (search.isBlank()) links
    else links.filter { it.name.contains(search, true) || it.url.contains(search, true) || it.category.contains(search, true) }

    val grouped = filtered.groupBy { it.category.ifBlank { "Uncategorized" } }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        // Search bar
        Row(Modifier.fillMaxWidth().padding(16.dp, 12.dp, 16.dp, 0.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = search, onValueChange = { search = it },
                placeholder = { Text("Search links…", color = TextSubtle) },
                leadingIcon = { Icon(Icons.Filled.Search, null, tint = TextMuted) },
                singleLine = true,
                modifier = Modifier.weight(1f),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault,
                    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
                ),
            )
            Spacer(Modifier.width(8.dp))
            IconButton(onClick = { showAdd = true }) {
                Icon(Icons.Filled.Add, "Add", tint = AccentBlue)
            }
        }
        Text("${filtered.size} of ${links.size} links", style = MaterialTheme.typography.labelSmall, color = TextSubtle, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))

        LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            grouped.forEach { (cat, items) ->
                item { Text(cat, style = MaterialTheme.typography.labelMedium, color = TextMuted, modifier = Modifier.padding(top = 4.dp)) }
                items(items) { link ->
                    LinkRow(link = link,
                        onClick = { openUrl(ctx, link.url) },
                        onDelete = { vm.deleteLink(link) },
                    )
                }
            }
        }
    }

    if (showAdd) {
        AddLinkDialog(onAdd = { name, url, cat, emoji ->
            vm.addLink(Link(id = UUID.randomUUID().toString(), name = name, url = url, category = cat, emoji = emoji))
            showAdd = false
        }, onDismiss = { showAdd = false })
    }
}

@Composable
fun LinkRow(link: Link, onClick: () -> Unit, onDelete: () -> Unit) {
    HomerCard {
        Row(
            Modifier.fillMaxWidth().clickable(onClick = onClick).padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (link.emoji.isNotBlank()) Text(link.emoji, fontSize = 22.sp, modifier = Modifier.padding(end = 10.dp))
            else Box(Modifier.size(22.dp).clip(RoundedCornerShape(6.dp)).background(AccentBlue.copy(0.2f)), contentAlignment = Alignment.Center) {
                Text(link.name.take(1).uppercase(), style = MaterialTheme.typography.labelSmall, color = AccentBlue, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(link.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Text(link.url, style = MaterialTheme.typography.labelSmall, color = TextMuted, maxLines = 1)
            }
            IconButton(onClick = onDelete, Modifier.size(28.dp)) {
                Icon(Icons.Filled.Close, null, tint = TextSubtle, modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
fun AddLinkDialog(onAdd: (String, String, String, String) -> Unit, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var url  by remember { mutableStateOf("") }
    var cat  by remember { mutableStateOf("") }
    var emoji by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = BgCard,
        title = { Text("Add Link") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple("Name *", name, { v: String -> name = v }),
                    Triple("URL *", url, { v: String -> url = v }),
                    Triple("Category", cat, { v: String -> cat = v }),
                    Triple("Emoji", emoji, { v: String -> emoji = v }),
                ).forEach { (label, value, setter) ->
                    OutlinedTextField(
                        value = value, onValueChange = setter, label = { Text(label) },
                        singleLine = true, modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedLabelColor = AccentBlue),
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { if (name.isNotBlank() && url.isNotBlank()) onAdd(name, url, cat, emoji) }) {
                Text("Add", color = AccentBlue)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } },
    )
}

private fun openUrl(ctx: Context, url: String) {
    try { CustomTabsIntent.Builder().build().launchUrl(ctx, Uri.parse(url)) }
    catch (_: Exception) { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
}
