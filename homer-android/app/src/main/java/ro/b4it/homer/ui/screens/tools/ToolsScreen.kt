package ro.b4it.homer.ui.screens.tools

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
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
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*

private data class Tool(val emoji: String, val name: String, val desc: String, val url: String)

private val TOOLS = listOf(
    Tool("☁️", "Nextcloud",   "Files & sync",       "https://cloud.b4it.ro"),
    Tool("📝", "Docs",        "Office suite",        "https://docs.b4it.ro"),
    Tool("✅", "Reminders",   "Task lists",          "https://tasks.b4it.ro"),
    Tool("📔", "Journal",     "Personal journal",    "https://journal.b4it.ro"),
    Tool("🎬", "Jellyfin",    "Media server",        "https://media.b4it.ro"),
    Tool("📒", "Notes",       "Quick notes",         "https://notes.b4it.ro"),
    Tool("📊", "Glance",      "Analytics",           "https://glance.b4it.ro"),
    Tool("📷", "Immich",      "Photo backup",        "https://photos.b4it.ro"),
    Tool("🔧", "Omnitools",   "Utility tools",       "https://tools.b4it.ro"),
    Tool("⬇️", "YT Download", "YouTube downloader", "https://ytdl.b4it.ro"),
    Tool("✉️", "AI Email",    "Email rewriter",      "https://email.b4it.ro"),
)

@Composable
fun ToolsScreen() {
    val ctx = LocalContext.current
    var keepAwake by remember { mutableStateOf(false) }

    // Keep awake effect
    DisposableEffect(keepAwake) {
        val activity = ctx as? ComponentActivity
        if (keepAwake) activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose { activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
    }

    Column(
        modifier = Modifier.fillMaxSize().background(BgPrimary)
            .verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Tools", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

        // Keep awake toggle
        HomerCard {
            Row(
                Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Keep Screen Awake", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                Switch(
                    checked = keepAwake, onCheckedChange = { keepAwake = it },
                    colors = SwitchDefaults.colors(checkedThumbColor = AccentAmber, checkedTrackColor = AccentAmber.copy(alpha = 0.3f)),
                )
            }
        }

        // Tools grid
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.heightIn(max = 2000.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(TOOLS) { tool ->
                ToolCard(tool = tool, onClick = { openUrl(ctx, tool.url) })
            }
        }
    }
}

@Composable
fun ToolCard(tool: Tool, onClick: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(BgCard)
            .border(1.dp, BorderDefault, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(tool.emoji, fontSize = 28.sp)
            Text(tool.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(tool.desc, style = MaterialTheme.typography.labelSmall, color = TextMuted)
        }
    }
}

private fun openUrl(ctx: Context, url: String) {
    try {
        CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
            .launchUrl(ctx, Uri.parse(url))
    } catch (_: Exception) {
        ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }
}
