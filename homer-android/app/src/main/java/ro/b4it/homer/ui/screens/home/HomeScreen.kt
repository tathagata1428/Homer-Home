package ro.b4it.homer.ui.screens.home

import android.Manifest
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.rememberPermissionState
import com.google.accompanist.permissions.isGranted
import ro.b4it.homer.data.local.entity.PomodoroTask
import ro.b4it.homer.data.local.entity.SavedQuote
import ro.b4it.homer.ui.theme.*
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun HomeScreen(vm: HomeViewModel = hiltViewModel()) {
    val now        by vm.now.collectAsStateWithLifecycle()
    val weather    by vm.weather.collectAsStateWithLifecycle()
    val quote      by vm.quote.collectAsStateWithLifecycle()
    val openTasks  by vm.openTasks.collectAsStateWithLifecycle(emptyList())
    val savedQuotes by vm.savedQuotes.collectAsStateWithLifecycle(emptyList())

    val locationPerm = rememberPermissionState(Manifest.permission.ACCESS_COARSE_LOCATION)
    LaunchedEffect(Unit) {
        if (!locationPerm.status.isGranted) locationPerm.launchPermissionRequest()
    }

    val greeting = when {
        now.hour < 12 -> "Good Morning"
        now.hour < 18 -> "Good Afternoon"
        else          -> "Good Evening"
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(BgPrimary),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Hero banner
        item {
            HeroBanner(greeting = greeting)
        }

        // Clock
        item {
            ClockCard(
                time = now.format(DateTimeFormatter.ofPattern("HH:mm")),
                seconds = now.second,
                date = now.format(DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy")),
            )
        }

        // Weather
        item {
            WeatherCard(
                ui = weather,
                onRefresh = vm::refreshWeather,
            )
        }

        // Quote
        item {
            QuoteCard(
                ui = quote,
                onNext = vm::nextQuote,
                onHumor = vm::toggleHumorMode,
                onSave = vm::saveCurrentQuote,
            )
        }

        // Saved quotes
        if (savedQuotes.isNotEmpty()) {
            item {
                SavedQuotesCard(quotes = savedQuotes, onDelete = vm::deleteSavedQuote)
            }
        }

        // Focus tasks
        item {
            FocusTasksCard(tasks = openTasks)
        }
    }
}

// ---- Hero Banner ----

@Composable
fun HeroBanner(greeting: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(BgCard)
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0x1AFFFFFF), Color(0x0FFFFFFF)),
                )
            )
            .border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(24.dp)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp, vertical = 28.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text(
                    "Homer",
                    style = TextStyle(
                        brush = Brush.linearGradient(
                            colors = listOf(Color.White, Color(0xFFCBD5E1), Color.White),
                        ),
                        fontSize = 40.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 0.5.sp,
                    ),
                )
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(
                            Brush.linearGradient(
                                colors = listOf(AccentGreen, Color(0xFF16A34A)),
                            )
                        )
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                ) {
                    Text(
                        greeting,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(0xFF041106),
                    )
                }
            }
            Spacer(Modifier.height(6.dp))
            Text(
                "\u201cTrying is the first step towards failure.\u201d \u2014 Homer Simpson",
                style = MaterialTheme.typography.bodyMedium,
                color = TextMuted,
            )
        }
    }
}

// ---- Clock Card ----

@Composable
fun ClockCard(time: String, seconds: Int, date: String) {
    HomerCard {
        Column(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text(time, fontSize = 52.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text(
                    text = ":%02d".format(seconds),
                    fontSize = 24.sp, fontWeight = FontWeight.Normal,
                    color = TextMuted,
                    modifier = Modifier.padding(bottom = 8.dp, start = 2.dp),
                )
            }
            Text(date, style = MaterialTheme.typography.bodyMedium, color = TextMuted)
        }
    }
}

// ---- Weather Card ----

@Composable
fun WeatherCard(ui: HomeViewModel.WeatherUi, onRefresh: () -> Unit) {
    HomerCard {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Weather", style = MaterialTheme.typography.titleSmall, color = TextMuted)
                Spacer(Modifier.weight(1f))
                IconButton(onClick = onRefresh, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Filled.Refresh, "Refresh", tint = TextMuted, modifier = Modifier.size(18.dp))
                }
            }
            Spacer(Modifier.height(8.dp))
            if (ui.loading) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp).align(Alignment.CenterHorizontally), color = AccentBlue)
            } else {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(ui.icon, fontSize = 40.sp)
                    Column {
                        Text(ui.temp, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                        Text(ui.desc, style = MaterialTheme.typography.bodySmall, color = TextMuted)
                        if (ui.place.isNotBlank())
                            Text(ui.place, style = MaterialTheme.typography.labelSmall, color = TextSubtle)
                    }
                }
                if (ui.forecast.isNotEmpty()) {
                    Spacer(Modifier.height(12.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(ui.forecast) { day ->
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(BgCardAlt)
                                    .padding(horizontal = 10.dp, vertical = 8.dp),
                            ) {
                                Text(day.day, style = MaterialTheme.typography.labelSmall, color = TextMuted)
                                Text(day.icon, fontSize = 20.sp)
                                Text(day.hi, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                                Text(day.lo, style = MaterialTheme.typography.labelSmall, color = TextMuted)
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---- Quote Card ----

@Composable
fun QuoteCard(ui: HomeViewModel.QuoteUi, onNext: () -> Unit, onHumor: () -> Unit, onSave: () -> Unit) {
    HomerCard {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (ui.humorMode) "Humor" else "Daily Inspiration",
                    style = MaterialTheme.typography.titleSmall, color = TextMuted,
                )
                Spacer(Modifier.weight(1f))
                val minsLeft = ui.nextRefreshSecs / 60
                Text("%02dm".format(minsLeft), style = MaterialTheme.typography.labelSmall, color = TextSubtle)
            }
            Spacer(Modifier.height(12.dp))
            if (ui.loading) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp).align(Alignment.CenterHorizontally), color = AccentBlue)
            } else {
                Text(
                    "\u201C${ui.text}\u201D",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextPrimary,
                    lineHeight = 22.sp,
                )
                Spacer(Modifier.height(8.dp))
                Text("— ${ui.author}", style = MaterialTheme.typography.labelMedium, color = AccentBlue)
            }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SmallChip("New Quote", onClick = onNext)
                SmallChip(if (ui.humorMode) "Motivational" else "Humor", onClick = onHumor)
                SmallChip("Save", onClick = onSave)
            }
        }
    }
}

// ---- Saved Quotes Card ----

@Composable
fun SavedQuotesCard(quotes: List<SavedQuote>, onDelete: (SavedQuote) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    HomerCard {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { expanded = !expanded },
            ) {
                Text("Saved Quotes (${quotes.size})", style = MaterialTheme.typography.titleSmall, color = TextMuted)
                Spacer(Modifier.weight(1f))
                Icon(
                    if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                    null, tint = TextMuted, modifier = Modifier.size(20.dp),
                )
            }
            if (expanded) {
                Spacer(Modifier.height(8.dp))
                quotes.forEach { q ->
                    Row(
                        verticalAlignment = Alignment.Top,
                        modifier = Modifier.padding(vertical = 4.dp),
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("\u201C${q.text}\u201D", style = MaterialTheme.typography.bodySmall, maxLines = 3, overflow = TextOverflow.Ellipsis)
                            Text("— ${q.author}", style = MaterialTheme.typography.labelSmall, color = AccentBlue)
                        }
                        IconButton(onClick = { onDelete(q) }, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Filled.Close, null, tint = TextSubtle, modifier = Modifier.size(16.dp))
                        }
                    }
                    HorizontalDivider(color = BorderSubtle)
                }
            }
        }
    }
}

// ---- Focus Tasks Card ----

@Composable
fun FocusTasksCard(tasks: List<PomodoroTask>) {
    HomerCard {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Text("Focus Tasks", style = MaterialTheme.typography.titleSmall, color = TextMuted)
            Spacer(Modifier.height(8.dp))
            if (tasks.isEmpty()) {
                Text("No open tasks", style = MaterialTheme.typography.bodySmall, color = TextSubtle)
            } else {
                tasks.take(5).forEach { task ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 4.dp),
                    ) {
                        Box(
                            Modifier.size(6.dp).clip(RoundedCornerShape(3.dp))
                                .background(AccentBlue),
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(task.text, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                if (tasks.size > 5)
                    Text("+${tasks.size - 5} more", style = MaterialTheme.typography.labelSmall, color = TextMuted, modifier = Modifier.padding(top = 4.dp))
            }
        }
    }
}

// ---- Shared composables ----

@Composable
fun HomerCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(BgCard)
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0x10FFFFFF), Color(0x07FFFFFF)),
                )
            )
            .border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(18.dp)),
    ) { content() }
}

@Composable
fun SmallChip(label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(BgCardAlt)
            .border(1.dp, BorderDefault, RoundedCornerShape(20.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = TextMuted)
    }
}
