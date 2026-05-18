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
import ro.b4it.homer.ui.screens.ambient.AmbientSound
import ro.b4it.homer.ui.screens.ambient.AmbientSoundsViewModel
import ro.b4it.homer.ui.screens.ambient.JsBridge
import ro.b4it.homer.ui.screens.ambient.LocalAmbientVm
import ro.b4it.homer.ui.theme.*

/** Minimal single-track ambient page. One per WebView so each has its own YT API instance. */
private fun ambientSoundHtml(key: String, ytId: String): String = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>body{margin:0;overflow:hidden;background:#000;}</style></head>
<body><div id="yt-$key"></div>
<script>
var tracks={'$key':{id:'$ytId',isPlaying:false,volume:70,player:null}};
function onYouTubeIframeAPIReady(){Object.keys(tracks).forEach(function(k){if(tracks[k].isPlaying&&!tracks[k].player)createPlayer(k);});}
function createPlayer(key){var t=tracks[key];if(t.player)return;if(typeof YT==='undefined'||!YT.Player)return;
t.player=new YT.Player('yt-'+key,{height:'1',width:'1',videoId:t.id,
playerVars:{autoplay:1,controls:0,loop:1,playlist:t.id,modestbranding:1},
events:{onReady:function(e){e.target.setVolume(t.volume);if(t.isPlaying)e.target.playVideo();else e.target.pauseVideo();try{Android.onPlayerReady(key);}catch(err){}},onError:function(){}}});}
function setVolAndPlay(key,vol){var t=tracks[key];if(!t)return;t.isPlaying=true;t.volume=vol;if(!t.player){createPlayer(key);return;}t.player.setVolume(vol);t.player.playVideo();}
function initAndPlay(key,vol){if(typeof YT!=='undefined'&&YT.Player){setVolAndPlay(key,vol);}else{setTimeout(function(){initAndPlay(key,vol);},1500);}}
function pauseSound(key){var t=tracks[key];if(!t)return;t.isPlaying=false;if(t.player&&t.player.pauseVideo)try{t.player.pauseVideo();}catch(e){}}
function setVolume(key,vol){var t=tracks[key];if(!t)return;t.volume=vol;if(t.player&&t.player.setVolume)try{t.player.setVolume(vol);}catch(e){}}
function stopAll(){Object.keys(tracks).forEach(function(k){tracks[k].isPlaying=false;if(tracks[k].player&&tracks[k].player.pauseVideo)try{tracks[k].player.pauseVideo();}catch(e){}});}
</script>
<script src="https://www.youtube.com/iframe_api"></script>
</body></html>"""

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
    // One WebView per sound — separate YT API instances = no one-at-a-time enforcement
    val soundWebViews = remember { mutableMapOf<String, WebView>() }
    val lifecycle  = LocalLifecycleOwner.current.lifecycle

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val notifPermission = rememberPermissionState(Manifest.permission.POST_NOTIFICATIONS)
        LaunchedEffect(Unit) {
            if (!notifPermission.status.isGranted) notifPermission.launchPermissionRequest()
        }
    }

    // Keep all sound WebViews alive through lifecycle events
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            soundWebViews.values.forEach { wv ->
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

    // Route JS commands to the correct per-sound WebView by extracting the track key
    LaunchedEffect(Unit) {
        ambientVm.jsCommands.collect { cmd ->
            when {
                cmd == "__reload__" -> soundWebViews.values.forEach { it.reload() }
                cmd.startsWith("stopAll") -> soundWebViews.values.forEach { it.evaluateJavascript(cmd, null) }
                else -> {
                    val key = Regex("""'([^']+)'""").find(cmd)?.groupValues?.getOrNull(1)
                    soundWebViews[key]?.evaluateJavascript(cmd, null)
                }
            }
        }
    }

    // One 1×1 dp WebView per sound — each has its own YouTube API instance so they
    // never share state and can all play audio simultaneously
    AmbientSound.values().forEach { sound ->
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
                    soundWebViews[sound.key] = this
                    loadDataWithBaseURL(
                        "https://b4it.ro/",
                        ambientSoundHtml(sound.key, sound.ytId),
                        "text/html", "UTF-8", null,
                    )
                }
            },
            modifier = Modifier.size(1.dp),
        )
    }

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
