package ro.b4it.homer.ui.screens.home

import android.Manifest
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.shape.CircleShape
import ro.b4it.homer.ui.theme.*
import java.text.SimpleDateFormat
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalPermissionsApi::class, ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(vm: HomeViewModel = hiltViewModel()) {
    val now              by vm.now.collectAsStateWithLifecycle()
    val weather          by vm.weather.collectAsStateWithLifecycle()
    val quote            by vm.quote.collectAsStateWithLifecycle()
    val openTasks        by vm.openTasks.collectAsStateWithLifecycle(emptyList())
    val inProgressKanban by vm.inProgressKanban.collectAsStateWithLifecycle(emptyList())
    val savedQuotes      by vm.savedQuotes.collectAsStateWithLifecycle(emptyList())
    val countdown        by vm.countdown.collectAsStateWithLifecycle()
    val cdVisible        by vm.cdVisible.collectAsStateWithLifecycle()
    val isRefreshing     by vm.isRefreshing.collectAsStateWithLifecycle()

    val locationPerm = rememberPermissionState(Manifest.permission.ACCESS_COARSE_LOCATION)
    LaunchedEffect(Unit) {
        if (!locationPerm.status.isGranted) locationPerm.launchPermissionRequest()
        vm.reloadCountdown()
    }

    val greeting = when {
        now.hour < 12 -> "Good Morning"
        now.hour < 18 -> "Good Afternoon"
        else          -> "Good Evening"
    }

    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh    = vm::pullAll,
        modifier     = Modifier.fillMaxSize(),
    ) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(BgPrimary),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
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
        if (openTasks.isNotEmpty() || inProgressKanban.isNotEmpty()) {
            item {
                FocusTasksCard(
                    pomodoroTasks    = openTasks,
                    kanbanTasks      = inProgressKanban,
                    onDeleteTask     = vm::deleteFocusTask,
                    onClearAll       = vm::clearAllFocusTasks,
                    onDoneKanbanTask = vm::moveKanbanTaskToDone,
                )
            }
        }

        // Countdown (last)
        if (countdown.hasEvent && cdVisible) {
            item {
                CountdownHomeCard(ui = countdown, onHide = vm::hideCountdownCard)
            }
        }
    }
    } // PullToRefreshBox
}

// ---- Hero Banner ----

@Composable
fun HeroBanner(greeting: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(BgCard)
            .border(1.dp, BorderDefault, RoundedCornerShape(20.dp)),
    ) {
        // Subtle warm amber wash at top
        Box(
            Modifier
                .fillMaxWidth()
                .height(90.dp)
                .background(Brush.verticalGradient(listOf(AccentAmber.copy(0.08f), Color.Transparent)))
        )
        Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 26.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "Homer",
                    style = TextStyle(
                        color = TextPrimary,
                        fontSize = 34.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.5).sp,
                    ),
                )
                Box(
                    Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(AccentBlue.copy(0.08f))
                        .border(1.dp, AccentBlue.copy(0.20f), RoundedCornerShape(20.dp))
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                ) {
                    Text(greeting, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = AccentBlue)
                }
            }
            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = BorderSubtle)
            Spacer(Modifier.height(12.dp))
            Text(
                "\u201cTrying is the first step towards failure.\u201d",
                style = MaterialTheme.typography.bodySmall,
                color = TextMuted,
                lineHeight = 20.sp,
                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
            )
            Text(
                "\u2014 Homer Simpson",
                fontSize = 10.sp,
                color = TextSubtle,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

// ---- Countdown Home Card ----

@Composable
fun CountdownHomeCard(ui: HomeViewModel.CountdownUi, onHide: () -> Unit = {}) {
    val dateFmt = remember { SimpleDateFormat("EEE, d MMM yyyy · HH:mm", Locale.getDefault()) }
    HomerCard {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text(
                        "COUNTDOWN",
                        fontSize = 10.sp, fontWeight = FontWeight.Bold,
                        letterSpacing = 3.sp, color = TextMuted,
                    )
                    if (ui.dateMs > 0L) {
                        Text(
                            dateFmt.format(Date(ui.dateMs)),
                            fontSize = 11.sp, color = TextSubtle,
                        )
                    }
                }
                IconButton(onClick = onHide, modifier = Modifier.size(28.dp)) {
                    Icon(
                        Icons.Filled.Close, "Hide countdown",
                        tint = TextMuted.copy(0.5f), modifier = Modifier.size(14.dp),
                    )
                }
            }

            Text(
                ui.name.ifBlank { "Event" },
                fontSize = 16.sp, fontWeight = FontWeight.SemiBold,
                color = TextPrimary,
            )

            if (ui.isPast) {
                Text(
                    "🎉 This event has already passed",
                    fontSize = 14.sp, color = NeonPink,
                    fontWeight = FontWeight.Medium,
                )
            } else {
                Row(
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(0.dp),
                ) {
                    MiniCountUnit(ui.days,  "DAYS", NeonPink,   largeWhenBig = true)
                    MiniSep()
                    MiniCountUnit(ui.hours, "HRS",  NeonCyan)
                    MiniSep()
                    MiniCountUnit(ui.mins,  "MIN",  NeonPurple)
                    MiniSep()
                    MiniCountUnit(ui.secs,  "SEC",  NeonGold)
                }
            }
        }
    }
}

@Composable
private fun MiniCountUnit(value: Long, label: String, color: Color, largeWhenBig: Boolean = false) {
    val padded = if (largeWhenBig && value >= 100) value.toString().padStart(3, '0')
                 else value.toString().padStart(2, '0')
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(horizontal = 5.dp),
    ) {
        AnimatedContent(
            targetState = padded,
            transitionSpec = {
                (slideInVertically(tween(200, easing = FastOutSlowInEasing)) { it } + fadeIn(tween(160)))
                    .togetherWith(slideOutVertically(tween(160)) { -it } + fadeOut(tween(130)))
            },
            label = "mini_$label",
        ) { str ->
            Text(
                text          = str,
                fontFamily    = androidx.compose.ui.text.font.FontFamily.Monospace,
                fontSize      = 28.sp,
                fontWeight    = FontWeight.Black,
                color         = color,
                letterSpacing = (-1).sp,
            )
        }
        Text(
            label,
            fontSize = 8.sp, fontWeight = FontWeight.Bold,
            letterSpacing = 2.sp, color = TextSubtle,
            modifier = Modifier.padding(top = 3.dp),
        )
    }
}

@Composable
private fun MiniSep() {
    Text(
        ":",
        fontSize = 20.sp, fontWeight = FontWeight.Light,
        color = TextSubtle.copy(0.4f),
        modifier = Modifier.offset(y = (-8).dp),
    )
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
    var showForecast by remember { mutableStateOf(false) }

    HomerCard {
        Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "WEATHER",
                    fontSize = 10.sp, fontWeight = FontWeight.Bold,
                    letterSpacing = 3.sp, color = TextMuted,
                )
                Spacer(Modifier.weight(1f))
                IconButton(onClick = onRefresh, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Filled.Refresh, "Refresh", tint = TextSubtle, modifier = Modifier.size(16.dp))
                }
            }
            Spacer(Modifier.height(12.dp))
            if (ui.loading) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp).align(Alignment.CenterHorizontally), color = AccentBlue)
            } else {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(ui.icon, fontSize = 40.sp)
                    Column(Modifier.weight(1f)) {
                        Text(ui.temp, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                        Text(ui.desc, style = MaterialTheme.typography.bodySmall, color = TextMuted)
                        if (ui.place.isNotBlank())
                            Text(ui.place, style = MaterialTheme.typography.labelSmall, color = TextSubtle)
                    }
                }
                if (ui.forecast.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    Row(
                        Modifier.fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(BgCardAlt)
                            .border(1.dp, BorderDefault, RoundedCornerShape(8.dp))
                            .clickable { showForecast = !showForecast }
                            .padding(horizontal = 12.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "This week",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSubtle,
                            modifier = Modifier.weight(1f),
                        )
                        Icon(
                            if (showForecast) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                            null, tint = TextSubtle, modifier = Modifier.size(16.dp),
                        )
                    }
                    if (showForecast) {
                        Spacer(Modifier.height(6.dp))
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            ui.forecast.forEach { day ->
                                Row(
                                    Modifier.fillMaxWidth()
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(BgCardAlt)
                                        .border(1.dp, BorderSubtle, RoundedCornerShape(8.dp))
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        day.day,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = TextMuted,
                                        modifier = Modifier.weight(1f),
                                    )
                                    Text(day.icon, fontSize = 18.sp)
                                    Spacer(Modifier.width(10.dp))
                                    Text(
                                        day.hi,
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary,
                                    )
                                    Text("  /  ", style = MaterialTheme.typography.labelSmall, color = TextSubtle)
                                    Text(day.lo, style = MaterialTheme.typography.labelSmall, color = TextMuted)
                                }
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
        Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (ui.humorMode) "HUMOR" else "DAILY QUOTE",
                    fontSize = 10.sp, fontWeight = FontWeight.Bold,
                    letterSpacing = 3.sp, color = TextMuted,
                )
                Spacer(Modifier.weight(1f))
                val minsLeft = ui.nextRefreshSecs / 60
                Text("%02dm".format(minsLeft), fontSize = 10.sp, color = TextSubtle, letterSpacing = 0.5.sp)
            }
            Spacer(Modifier.height(14.dp))
            if (ui.loading) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp).align(Alignment.CenterHorizontally), color = AccentBlue)
            } else {
                Text(
                    "\u201C${ui.text}\u201D",
                    fontSize = 15.sp, lineHeight = 23.sp,
                    color = TextPrimary.copy(0.9f),
                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    "\u2014 ${ui.author}",
                    fontSize = 12.sp, color = NeonGold.copy(0.7f),
                    fontWeight = FontWeight.Medium, letterSpacing = 0.3.sp,
                )
            }
            Spacer(Modifier.height(14.dp))
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
        Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { expanded = !expanded },
            ) {
                Text(
                    "SAVED QUOTES  (${quotes.size})",
                    fontSize = 10.sp, fontWeight = FontWeight.Bold,
                    letterSpacing = 3.sp, color = TextMuted,
                )
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

private fun relativeTime(ms: Long): String {
    val diff = System.currentTimeMillis() - ms
    return when {
        diff < 60_000       -> "just now"
        diff < 3_600_000    -> "${diff / 60_000}m ago"
        diff < 86_400_000   -> "${diff / 3_600_000}h ago"
        else                -> "${diff / 86_400_000}d ago"
    }
}

@Composable
fun FocusTasksCard(
    pomodoroTasks: List<PomodoroTask>,
    kanbanTasks: List<ro.b4it.homer.data.local.entity.KanbanTask>,
    onDeleteTask: (PomodoroTask) -> Unit = {},
    onClearAll: () -> Unit = {},
    onDoneKanbanTask: (ro.b4it.homer.data.local.entity.KanbanTask) -> Unit = {},
) {
    HomerCard {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Header accent bar
            Box(Modifier.fillMaxWidth().height(2.dp).background(
                Brush.horizontalGradient(listOf(AccentBlue.copy(0.5f), AccentViolet.copy(0.3f), Color.Transparent))
            ))
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("IN FOCUS", fontSize = 10.sp, letterSpacing = 2.sp, color = NeonPink.copy(0.8f), fontWeight = FontWeight.ExtraBold)
                        val total = pomodoroTasks.size + kanbanTasks.size
                        Text("$total active item${if (total != 1) "s" else ""}", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    }
                    if (pomodoroTasks.isNotEmpty()) {
                        Box(
                            Modifier.clip(RoundedCornerShape(6.dp))
                                .background(AccentRed.copy(0.07f))
                                .border(1.dp, AccentRed.copy(0.3f), RoundedCornerShape(6.dp))
                                .clickable { onClearAll() }
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                        ) {
                            Text("CLEAR", fontSize = 7.sp, letterSpacing = 1.sp, color = AccentRed.copy(0.8f), fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.width(6.dp))
                    }
                    Text("⚡", fontSize = 16.sp)
                }

                // Kanban in-progress tasks
                kanbanTasks.take(3).forEach { task ->
                    val priorityColor = when (task.priority) {
                        "critical" -> AccentRed
                        "high"     -> AccentAmber
                        "low"      -> AccentGreen
                        else       -> AccentBlue
                    }
                    Row(
                        Modifier.fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(BgCardAlt)
                            .border(1.dp, priorityColor.copy(0.2f), RoundedCornerShape(8.dp))
                            .padding(start = 10.dp, top = 8.dp, bottom = 8.dp, end = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Box(Modifier.size(6.dp).clip(CircleShape).background(priorityColor))
                        Text(
                            task.summary,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Box(
                            Modifier.clip(RoundedCornerShape(4.dp))
                                .background(AccentAmber.copy(0.15f))
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                        ) {
                            Text("In Progress", style = MaterialTheme.typography.labelSmall, color = AccentAmber, fontWeight = FontWeight.SemiBold)
                        }
                        IconButton(onClick = { onDoneKanbanTask(task) }, modifier = Modifier.size(20.dp)) {
                            Icon(Icons.Filled.Check, null, tint = AccentGreen.copy(0.7f), modifier = Modifier.size(13.dp))
                        }
                    }
                }

                // Pomodoro tasks
                pomodoroTasks.take(4).forEach { task ->
                    Row(
                        Modifier.fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(BgCardAlt)
                            .border(1.dp, BorderDefault, RoundedCornerShape(8.dp))
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Box(Modifier.size(6.dp).clip(CircleShape).background(AccentBlue.copy(0.6f)))
                        Text(
                            task.text,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.weight(1f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        IconButton(onClick = { onDeleteTask(task) }, modifier = Modifier.size(20.dp)) {
                            Icon(Icons.Filled.Close, null, tint = TextSubtle.copy(0.5f), modifier = Modifier.size(12.dp))
                        }
                    }
                }

                val extra = (pomodoroTasks.size - 4).coerceAtLeast(0) + (kanbanTasks.size - 3).coerceAtLeast(0)
                if (extra > 0) {
                    Text("+$extra more task${if (extra > 1) "s" else ""}", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                }
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
            .clip(RoundedCornerShape(16.dp))
            .background(BgCard)
            .border(1.dp, BorderDefault, RoundedCornerShape(16.dp)),
    ) { content() }
}

@Composable
fun SmallChip(label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(BgCardAlt)
            .border(1.dp, BorderDefault, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 7.dp),
    ) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = TextMuted, letterSpacing = 0.3.sp)
    }
}
