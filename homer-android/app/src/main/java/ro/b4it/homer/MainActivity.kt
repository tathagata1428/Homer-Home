package ro.b4it.homer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import dagger.hilt.android.AndroidEntryPoint
import ro.b4it.homer.data.sync.SyncEngine
import ro.b4it.homer.ui.HomerApp
import ro.b4it.homer.ui.theme.HomerTheme
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var syncEngine: SyncEngine
    private var lastForegroundPullMs = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            HomerTheme {
                HomerApp()
            }
        }
    }

    /** Pull fresh data whenever the app returns to foreground, at most once per 60s. */
    override fun onResume() {
        super.onResume()
        val now = System.currentTimeMillis()
        if (now - lastForegroundPullMs > 60_000L) {
            lastForegroundPullMs = now
            syncEngine.start()
        }
    }
}
