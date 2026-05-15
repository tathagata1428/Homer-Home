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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*

private data class Tool(
    val emoji: String,
    val name: String,
    val desc: String,
    val url: String,       // empty = action
)

private val TOOLS = listOf(
    Tool("☁️", "Nextcloud",           "Files & sync",               "https://cloud.b4it.ro"),
    Tool("📚", "Docs",                "Personal documentation",     "https://docs.b4it.ro"),
    Tool("⏰", "Reminders",           "Manage reminders & tasks",   "https://reminder.b4it.ro/reminders"),
    Tool("📔", "Journal",             "Daily notes & reflections",  "https://journal.b4it.ro"),
    Tool("🍿", "Jellyfin",            "Personal media server",      "https://jellyfin.b4it.ro"),
    Tool("✏️", "Notes",               "Quick notes & to-dos",       "https://tasks.b4it.ro"),
    Tool("✨", "Glance",              "Various widgets",            "https://glance.b4it.ro"),
    Tool("🖼️", "Immich",              "Self-hosted photos",         "https://immich.b4it.ro"),
    Tool("🛠️", "Omnitools",           "All-in-one utility toolkit", "https://omnitools.b4it.ro"),
    Tool("🎬", "YT Download",         "Download videos & audio",    "https://getyoutube.b4it.ro"),
    Tool("✉️", "AI Email",            "Email & text proofer",       "https://redefine.b4it.ro"),
)

@Composable
fun ToolsScreen() {
    val ctx = LocalContext.current
    var keepAwake by remember { mutableStateOf(false) }

    DisposableEffect(keepAwake) {
        val activity = ctx as? ComponentActivity
        if (keepAwake) activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose { activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("My Tools", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

        // Tools grid — 3 columns like the website
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            modifier = Modifier.heightIn(max = 2400.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // Keep Awake — first grid item like website
            item {
                KeepAwakeCard(keepAwake = keepAwake, onToggle = { keepAwake = !keepAwake })
            }
            items(TOOLS) { tool ->
                ToolCard(tool = tool, onClick = { openUrl(ctx, tool.url) })
            }
        }
    }
}

@Composable
private fun KeepAwakeCard(keepAwake: Boolean, onToggle: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(
                if (keepAwake)
                    Brush.verticalGradient(listOf(AccentAmber.copy(alpha = 0.15f), AccentAmber.copy(alpha = 0.08f)))
                else
                    Brush.verticalGradient(listOf(Color(0x10FFFFFF), Color(0x07FFFFFF)))
            )
            .border(
                1.dp,
                if (keepAwake) AccentAmber.copy(alpha = 0.4f) else Color(0x1FFFFFFF),
                RoundedCornerShape(14.dp),
            )
            .clickable(onClick = onToggle)
            .padding(14.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("☀️", fontSize = 24.sp)
            Text(
                "Keep Awake",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = if (keepAwake) AccentAmber else TextPrimary,
            )
            Text(
                if (keepAwake) "On" else "Prevents sleep",
                style = MaterialTheme.typography.labelSmall,
                color = if (keepAwake) AccentAmber.copy(alpha = 0.8f) else TextMuted,
            )
        }
    }
}

@Composable
private fun ToolCard(tool: Tool, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(BgCard)
            .background(Brush.verticalGradient(listOf(Color(0x10FFFFFF), Color(0x07FFFFFF))))
            .border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(tool.emoji, fontSize = 24.sp)
            Text(
                tool.name,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                tool.desc,
                style = MaterialTheme.typography.labelSmall,
                color = TextMuted,
                maxLines = 2,
            )
        }
    }
}

private fun openUrl(ctx: Context, url: String) {
    if (url.isBlank()) return
    try {
        CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
            .launchUrl(ctx, Uri.parse(url))
    } catch (_: Exception) {
        ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }
}
