package ro.b4it.homer.ui

import android.Manifest
import android.annotation.SuppressLint
import android.os.Build
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.ui.graphics.Brush
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import ro.b4it.homer.ui.navigation.AppNavHost
import ro.b4it.homer.ui.navigation.Screen
import ro.b4it.homer.ui.screens.ambient.AmbientSoundsViewModel
import ro.b4it.homer.ui.screens.ambient.JsBridge
import ro.b4it.homer.ui.screens.ambient.LocalAmbientVm
import ro.b4it.homer.ui.theme.*

private data class BottomNavItem(val screen: Screen, val label: String, val icon: ImageVector)

private val bottomNavItems = listOf(
    BottomNavItem(Screen.Home,  "Home",  Icons.Filled.Home),
    BottomNavItem(Screen.Focus, "Focus", Icons.Filled.Timer),
    BottomNavItem(Screen.Vault, "Vault", Icons.Filled.Lock),
    BottomNavItem(Screen.Joey,  "Joey",  Icons.Filled.Chat),
)

private data class MoreItem(val emoji: String, val label: String, val screen: Screen)

private val moreItems = listOf(
    MoreItem("🧪", "Focus Lab",   Screen.FocusLab),
    MoreItem("🔧", "Tools",       Screen.Tools),
    MoreItem("🎧", "Ambient",     Screen.Ambient),
    MoreItem("📰", "News",        Screen.News),
    MoreItem("📋", "Daily Brief", Screen.DailyBrief),
    MoreItem("💰", "Investing",   Screen.Investing),
    MoreItem("🔗", "Links",       Screen.Links),
    MoreItem("📔", "Journal",     Screen.Journal),
    MoreItem("📝", "Notes",       Screen.Notes),
    MoreItem("📥", "Inbox",       Screen.Inbox),
    MoreItem("⏰", "Reminders",   Screen.Reminders),
    MoreItem("⏳", "Countdown",   Screen.Countdown),
    MoreItem("👤", "Account",     Screen.Account),
    MoreItem("🔄", "Sync",        Screen.Sync),
    MoreItem("⚙️", "Settings",    Screen.Settings),
)

private val moreRoutes = moreItems.map { it.screen.route }.toSet()

@OptIn(ExperimentalMaterial3Api::class, ExperimentalPermissionsApi::class)
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun HomerApp() {
    val navController  = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute   = backStackEntry?.destination?.route
    var showMore       by remember { mutableStateOf(false) }

    // Activity-scoped ambient VM — survives tab navigation
    val ambientVm: AmbientSoundsViewModel = hiltViewModel()
    val webViewRef = remember { mutableStateOf<WebView?>(null) }
    val lifecycle  = LocalLifecycleOwner.current.lifecycle

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val notifPermission = rememberPermissionState(Manifest.permission.POST_NOTIFICATIONS)
        LaunchedEffect(Unit) {
            if (!notifPermission.status.isGranted) notifPermission.launchPermissionRequest()
        }
    }

    // Persistent hidden WebView — single AudioContext so all sounds mix simultaneously
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            webViewRef.value?.let { wv ->
                when (event) {
                    Lifecycle.Event.ON_RESUME -> { wv.onResume(); wv.resumeTimers() }
                    Lifecycle.Event.ON_PAUSE,
                    Lifecycle.Event.ON_STOP   -> {
                        if (ambientVm.anyPlaying) {
                            android.os.Handler(android.os.Looper.getMainLooper()).post {
                                wv.onResume()
                                wv.resumeTimers()
                            }
                        } else {
                            wv.onPause()
                            wv.pauseTimers()
                        }
                    }
                    else -> {}
                }
            }
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(Unit) {
        ambientVm.jsCommands.collect { cmd ->
            if (cmd == "__reload__") webViewRef.value?.reload()
            else webViewRef.value?.evaluateJavascript(cmd, null)
        }
    }

    AndroidView(
        factory = { ctx ->
            WebView(ctx).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                @Suppress("DEPRECATION")
                settings.mediaPlaybackRequiresUserGesture = false
                @Suppress("DEPRECATION")
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                settings.userAgentString =
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                CookieManager.getInstance().setAcceptCookie(true)
                CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView, url: String) {
                        view.evaluateJavascript("""
                            Object.defineProperty(document,'visibilityState',{configurable:true,get:function(){return 'visible';}});
                            Object.defineProperty(document,'hidden',{configurable:true,get:function(){return false;}});
                        """.trimIndent(), null)
                    }
                }
                addJavascriptInterface(JsBridge(ambientVm), "Android")
                val html = ctx.assets.open("ambient.html").bufferedReader().use { it.readText() }
                loadDataWithBaseURL("https://b4it.ro/", html, "text/html", "UTF-8", null)
                webViewRef.value = this
            }
        },
        modifier = Modifier.size(1.dp),
    )

    CompositionLocalProvider(LocalAmbientVm provides ambientVm) {
    if (showMore) {
        ModalBottomSheet(
            onDismissRequest = { showMore = false },
            containerColor = BgCard,
            dragHandle = { BottomSheetDefaults.DragHandle(color = TextSubtle) },
        ) {
            Column(
                modifier = Modifier
                    .padding(horizontal = 16.dp)
                    .navigationBarsPadding(),
            ) {
                Column(
                    modifier = Modifier.padding(bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text("MORE", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 3.sp, color = TextPrimary)
                    Box(
                        Modifier.width(36.dp).height(2.dp)
                            .background(Brush.horizontalGradient(listOf(NeonPink, NeonCyan)))
                    )
                }
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.heightIn(max = 600.dp),
                ) {
                    items(moreItems) { item ->
                        val isSelected = currentRoute == item.screen.route
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .clip(RoundedCornerShape(14.dp))
                                .background(if (isSelected) NeonPink.copy(alpha = 0.1f) else BgCardAlt)
                                .border(
                                    1.dp,
                                    if (isSelected) NeonPink.copy(0.55f) else androidx.compose.ui.graphics.Color(0x12FFFFFF),
                                    RoundedCornerShape(14.dp),
                                )
                                .clickable {
                                    showMore = false
                                    navController.navigate(item.screen.route) {
                                        popUpTo(Screen.Home.route) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                                .padding(vertical = 14.dp, horizontal = 8.dp),
                        ) {
                            Text(item.emoji, fontSize = 26.sp)
                            Spacer(Modifier.height(7.dp))
                            Text(
                                item.label,
                                style = MaterialTheme.typography.labelSmall,
                                color = if (isSelected) NeonPink else TextMuted,
                                fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.Medium,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = BgPrimary,
        bottomBar = {
            Column {
                HorizontalDivider(
                    thickness = 1.dp,
                    color = NeonPink.copy(alpha = 0.25f),
                )
                NavigationBar(
                    containerColor = BgCard,
                    tonalElevation = 0.dp,
                ) {
                    bottomNavItems.forEach { item ->
                        NavigationBarItem(
                            selected = currentRoute == item.screen.route,
                            onClick = {
                                navController.navigate(item.screen.route) {
                                    popUpTo(Screen.Home.route) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label, fontSize = 10.sp, letterSpacing = 0.5.sp) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor   = NeonPink,
                                selectedTextColor   = NeonPink,
                                unselectedIconColor = TextMuted,
                                unselectedTextColor = TextSubtle,
                                indicatorColor      = NeonPink.copy(alpha = 0.12f),
                            ),
                        )
                    }
                    NavigationBarItem(
                        selected = currentRoute in moreRoutes,
                        onClick = { showMore = true },
                        icon = { Icon(Icons.Filled.GridView, contentDescription = "More") },
                        label = { Text("More", fontSize = 10.sp, letterSpacing = 0.5.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor   = NeonCyan,
                            selectedTextColor   = NeonCyan,
                            unselectedIconColor = TextMuted,
                            unselectedTextColor = TextSubtle,
                            indicatorColor      = NeonCyan.copy(alpha = 0.12f),
                        ),
                    )
                }
            }
        },
    ) { innerPadding ->
        AppNavHost(navController = navController, innerPadding = innerPadding)
    }
    } // end CompositionLocalProvider
}
