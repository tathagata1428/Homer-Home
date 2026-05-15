package ro.b4it.homer.ui.screens.ambient

import android.annotation.SuppressLint
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.screens.home.SmallChip
import ro.b4it.homer.ui.theme.*

/** Matches the website's ambient sound page exactly — same YouTube IDs, same presets. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun AmbientSoundsScreen(vm: AmbientSoundsViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val webViewRef = remember { mutableStateOf<WebView?>(null) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle

    // Keep WebView timers alive when sounds are playing and app is backgrounded
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            webViewRef.value?.let { wv ->
                when (event) {
                    Lifecycle.Event.ON_RESUME -> { wv.onResume(); wv.resumeTimers() }
                    Lifecycle.Event.ON_PAUSE  -> {
                        if (vm.anyPlaying) wv.resumeTimers() // keep JS running for audio
                        else { wv.onPause(); wv.pauseTimers() }
                    }
                    else -> {}
                }
            }
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }

    // Apply JS commands emitted by ViewModel — directly on main thread, no extra post()
    LaunchedEffect(Unit) {
        vm.jsCommands.collect { cmd ->
            webViewRef.value?.evaluateJavascript(cmd, null)
        }
    }

    // Hidden WebView — actual YouTube players live here
    AndroidView(
        factory = { ctx ->
            WebView(ctx).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                @Suppress("DEPRECATION")
                settings.mediaPlaybackRequiresUserGesture = false
                @Suppress("DEPRECATION")
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                settings.userAgentString = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                CookieManager.getInstance().setAcceptCookie(true)
                CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView, url: String) {
                        // Override Page Visibility API so YouTube doesn't pause when app is backgrounded
                        view.evaluateJavascript("""
                            Object.defineProperty(document,'visibilityState',{configurable:true,get:function(){return 'visible';}});
                            Object.defineProperty(document,'hidden',{configurable:true,get:function(){return false;}});
                        """.trimIndent(), null)
                    }
                }
                addJavascriptInterface(JsBridge(vm), "Android")
                // Load from b4it.ro so YouTube IFrame API sees a trusted HTTPS origin
                loadUrl("https://b4it.ro/api/ambient")
                webViewRef.value = this
            }
        },
        modifier = Modifier.size(1.dp),
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "Ambient Sounds",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )

        // Presets strip
        HomerCard {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Presets",
                        style = MaterialTheme.typography.titleSmall,
                        color = TextMuted,
                        modifier = Modifier.weight(1f),
                    )
                    if (state.any { it.value.playing }) {
                        SmallChip("⏹ Stop All") { vm.stopAll() }
                    }
                }
                Spacer(Modifier.height(10.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                ) {
                    AmbientPreset.values().forEach { preset ->
                        SmallChip(preset.label) { vm.applyPreset(preset) }
                    }
                }
            }
        }

        // Sound grid — 2 columns, same as website
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.heightIn(max = 1600.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(AmbientSound.values().toList()) { sound ->
                val s = state[sound] ?: SoundState()
                SoundCard(
                    sound = sound,
                    state = s,
                    onToggle = { vm.toggle(sound) },
                    onVolume = { vm.setVolume(sound, it) },
                )
            }
        }
    }
}

@Composable
private fun SoundCard(
    sound: AmbientSound,
    state: SoundState,
    onToggle: () -> Unit,
    onVolume: (Int) -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (state.playing) AccentBlue.copy(alpha = 0.10f) else BgCard)
            .border(
                1.dp,
                if (state.playing) AccentBlue.copy(alpha = 0.45f) else BorderDefault,
                RoundedCornerShape(16.dp),
            )
            .clickable(onClick = onToggle)
            .padding(14.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(sound.emoji, fontSize = 26.sp)
                Icon(
                    if (state.playing) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                    contentDescription = null,
                    tint = if (state.playing) AccentBlue else TextMuted,
                    modifier = Modifier.size(22.dp),
                )
            }
            Text(
                sound.label,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold,
                color = if (state.playing) TextPrimary else TextMuted,
            )
            if (state.playing) {
                Slider(
                    value = state.volume.toFloat(),
                    onValueChange = { onVolume(it.toInt()) },
                    valueRange = 0f..100f,
                    modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
                    colors = SliderDefaults.colors(
                        thumbColor = AccentBlue,
                        activeTrackColor = AccentBlue,
                        inactiveTrackColor = BorderDefault,
                    ),
                )
            }
        }
    }
}

/** JavaScript bridge — called from the WebView's HTML player. */
private class JsBridge(private val vm: AmbientSoundsViewModel) {
    @JavascriptInterface
    fun onPlayerReady(key: String) = vm.onPlayerReady(key)
}

