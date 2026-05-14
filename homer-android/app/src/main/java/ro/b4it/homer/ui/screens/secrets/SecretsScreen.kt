package ro.b4it.homer.ui.screens.secrets

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.VaultCredential
import ro.b4it.homer.data.local.entity.VaultLink
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*
import java.util.UUID

@Composable
fun SecretsScreen(vm: SecretsViewModel = hiltViewModel()) {
    val creds  by vm.credentials.collectAsStateWithLifecycle(emptyList())
    val links  by vm.links.collectAsStateWithLifecycle(emptyList())
    var tab    by remember { mutableStateOf(0) }
    var showAddCred  by remember { mutableStateOf(false) }
    var showAddLink  by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        Row(Modifier.fillMaxWidth().padding(16.dp, 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Passwords & Secrets", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            IconButton(onClick = { if (tab == 0) showAddCred = true else showAddLink = true }) {
                Icon(Icons.Filled.Add, null, tint = AccentBlue)
            }
        }

        TabRow(selectedTabIndex = tab, containerColor = BgCard) {
            listOf("Passwords", "Secret Links").forEachIndexed { i, label ->
                Tab(selected = tab == i, onClick = { tab = i }, text = { Text(label, style = MaterialTheme.typography.labelMedium) })
            }
        }

        when (tab) {
            0 -> CredentialsList(creds, onDelete = vm::deleteCredential)
            1 -> SecretLinksList(links, onDelete = vm::deleteLink)
        }
    }

    if (showAddCred) AddCredentialDialog(onAdd = { label, site, user, pw, details -> vm.addCredential(label, site, user, pw, details); showAddCred = false }, onDismiss = { showAddCred = false })
    if (showAddLink) AddLinkDialog(onAdd = { name, url, desc -> vm.addLink(name, url, desc); showAddLink = false }, onDismiss = { showAddLink = false })
}

@Composable
fun CredentialsList(creds: List<VaultCredential>, onDelete: (VaultCredential) -> Unit) {
    val clipboard = LocalClipboardManager.current
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(creds) { cred ->
            var showPw by remember { mutableStateOf(false) }
            HomerCard {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("🔑", fontSize = 20.sp, modifier = Modifier.padding(end = 8.dp))
                        Column(Modifier.weight(1f)) {
                            Text(cred.label, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                            if (cred.site.isNotBlank()) Text(cred.site, style = MaterialTheme.typography.labelSmall, color = AccentBlue)
                        }
                        IconButton(onClick = { onDelete(cred) }, Modifier.size(28.dp)) {
                            Icon(Icons.Filled.Delete, null, tint = AccentRed.copy(0.7f), modifier = Modifier.size(16.dp))
                        }
                    }
                    if (cred.username.isNotBlank()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(cred.username, style = MaterialTheme.typography.bodySmall, color = TextMuted, modifier = Modifier.weight(1f))
                            IconButton(onClick = { clipboard.setText(AnnotatedString(cred.username)) }, Modifier.size(24.dp)) {
                                Icon(Icons.Filled.ContentCopy, null, tint = TextSubtle, modifier = Modifier.size(14.dp))
                            }
                        }
                    }
                    if (cred.passwordEncrypted.isNotBlank()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                if (showPw) cred.passwordEncrypted else "••••••••",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextMuted,
                                modifier = Modifier.weight(1f),
                            )
                            IconButton(onClick = { showPw = !showPw }, Modifier.size(24.dp)) {
                                Icon(if (showPw) Icons.Filled.VisibilityOff else Icons.Filled.Visibility, null, tint = TextSubtle, modifier = Modifier.size(14.dp))
                            }
                            IconButton(onClick = { clipboard.setText(AnnotatedString(cred.passwordEncrypted)) }, Modifier.size(24.dp)) {
                                Icon(Icons.Filled.ContentCopy, null, tint = TextSubtle, modifier = Modifier.size(14.dp))
                            }
                        }
                    }
                    if (cred.details.isNotBlank()) Text(cred.details, style = MaterialTheme.typography.bodySmall, color = TextSubtle)
                }
            }
        }
    }
}

@Composable
fun SecretLinksList(links: List<VaultLink>, onDelete: (VaultLink) -> Unit) {
    val clipboard = LocalClipboardManager.current
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(links) { link ->
            HomerCard {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("🔗", fontSize = 20.sp, modifier = Modifier.padding(end = 8.dp))
                    Column(Modifier.weight(1f)) {
                        Text(link.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        Text(link.url, style = MaterialTheme.typography.labelSmall, color = AccentBlue, maxLines = 1)
                        if (link.description.isNotBlank()) Text(link.description, style = MaterialTheme.typography.bodySmall, color = TextMuted)
                    }
                    IconButton(onClick = { clipboard.setText(AnnotatedString(link.url)) }, Modifier.size(28.dp)) {
                        Icon(Icons.Filled.ContentCopy, null, tint = TextSubtle, modifier = Modifier.size(14.dp))
                    }
                    IconButton(onClick = { onDelete(link) }, Modifier.size(28.dp)) {
                        Icon(Icons.Filled.Delete, null, tint = AccentRed.copy(0.7f), modifier = Modifier.size(14.dp))
                    }
                }
            }
        }
    }
}

@Composable
fun AddCredentialDialog(onAdd: (String, String, String, String, String) -> Unit, onDismiss: () -> Unit) {
    var label by remember { mutableStateOf("") }; var site by remember { mutableStateOf("") }
    var user  by remember { mutableStateOf("") }; var pw   by remember { mutableStateOf("") }
    var details by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, containerColor = BgCard, title = { Text("Add Password") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(Triple("Label *", label, { v: String -> label = v }), Triple("Site URL", site, { v: String -> site = v }), Triple("Username", user, { v: String -> user = v }), Triple("Password", pw, { v: String -> pw = v }), Triple("Details", details, { v: String -> details = v }))
                    .forEach { (lbl, value, setter) ->
                        OutlinedTextField(value = value, onValueChange = setter, label = { Text(lbl) }, singleLine = true, modifier = Modifier.fillMaxWidth(), visualTransformation = if (lbl == "Password") PasswordVisualTransformation() else VisualTransformation.None,
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedLabelColor = AccentBlue))
                    }
            }
        },
        confirmButton = { TextButton(onClick = { if (label.isNotBlank()) onAdd(label, site, user, pw, details) }) { Text("Add", color = AccentBlue) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } })
}

@Composable
fun AddLinkDialog(onAdd: (String, String, String) -> Unit, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf("") }; var url by remember { mutableStateOf("") }; var desc by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, containerColor = BgCard, title = { Text("Add Secret Link") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(Triple("Name *", name, { v: String -> name = v }), Triple("URL *", url, { v: String -> url = v }), Triple("Description", desc, { v: String -> desc = v }))
                    .forEach { (lbl, value, setter) ->
                        OutlinedTextField(value = value, onValueChange = setter, label = { Text(lbl) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedLabelColor = AccentBlue))
                    }
            }
        },
        confirmButton = { TextButton(onClick = { if (name.isNotBlank() && url.isNotBlank()) onAdd(name, url, desc) }) { Text("Add", color = AccentBlue) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } })
}
