package ro.b4it.homer.ui.screens.news

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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*

@Composable
fun NewsScreen(vm: NewsViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val ctx = LocalContext.current

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        // Header
        Row(Modifier.fillMaxWidth().padding(16.dp, 12.dp, 16.dp, 0.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("News & Videos", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }
        // Region + Source selectors
        Row(Modifier.fillMaxWidth().padding(16.dp, 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            RegionChips(state.region, state.availableRegions, onSelect = vm::setRegion, modifier = Modifier.weight(1f))
        }

        LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    SourceSelector(state.source, state.availableSources, onSelect = vm::setSource, modifier = Modifier.weight(1f))
                    Spacer(Modifier.width(8.dp))
                    IconButton(onClick = vm::refresh) { Icon(Icons.Filled.Refresh, null, tint = TextMuted) }
                }
            }

            if (state.loading) {
                item { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = AccentBlue) } }
            } else if (state.error != null) {
                item { Text("Failed to load news: ${state.error}", color = AccentRed, modifier = Modifier.padding(16.dp)) }
            } else {
                items(state.articles) { a ->
                    NewsArticleCard(article = a, onClick = { openUrl(ctx, a.link) })
                }
            }
        }
    }
}

@Composable
fun RegionChips(selected: String, regions: List<String>, onSelect: (String) -> Unit, modifier: Modifier) {
    Row(modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        regions.forEach { r ->
            FilterChip(
                selected = r == selected,
                onClick = { onSelect(r) },
                label = { Text(r, style = MaterialTheme.typography.labelSmall) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = AccentBlue,
                    selectedLabelColor = TextPrimary,
                    containerColor = BgCard,
                    labelColor = TextMuted,
                ),
            )
        }
    }
}

@Composable
fun SourceSelector(selected: String, sources: List<String>, onSelect: (String) -> Unit, modifier: Modifier) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier) {
        OutlinedButton(onClick = { expanded = true }, border = BorderStroke(1.dp, BorderDefault)) {
            Text(selected.take(20), style = MaterialTheme.typography.labelSmall, color = TextMuted)
            Icon(Icons.Filled.ArrowDropDown, null, tint = TextMuted)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, containerColor = BgCard) {
            sources.forEach { src ->
                DropdownMenuItem(text = { Text(src, style = MaterialTheme.typography.labelSmall) }, onClick = { onSelect(src); expanded = false })
            }
        }
    }
}

@Composable
fun NewsArticleCard(article: NewsArticle, onClick: () -> Unit) {
    HomerCard {
        Column(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(14.dp)) {
            Text(article.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, maxLines = 3, overflow = TextOverflow.Ellipsis)
            if (article.description.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(article.description, style = MaterialTheme.typography.bodySmall, color = TextMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(article.source, style = MaterialTheme.typography.labelSmall, color = AccentBlue)
                if (article.pubDate.isNotBlank()) Text("•", color = TextSubtle, style = MaterialTheme.typography.labelSmall)
                if (article.pubDate.isNotBlank()) Text(article.pubDate, style = MaterialTheme.typography.labelSmall, color = TextSubtle)
            }
        }
    }
}

private fun openUrl(ctx: Context, url: String) {
    try { CustomTabsIntent.Builder().build().launchUrl(ctx, Uri.parse(url)) }
    catch (_: Exception) { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
}
