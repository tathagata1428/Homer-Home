package ro.b4it.homer.ui.screens.investing

import android.annotation.SuppressLint
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*

@Composable
fun InvestingScreen() {
    Column(
        modifier = Modifier.fillMaxSize().background(BgPrimary)
            .verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Market Intelligence", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

        HomerCard {
            Column(Modifier.padding(12.dp)) {
                Text("S&P 500", style = MaterialTheme.typography.titleSmall, color = TextMuted)
                Spacer(Modifier.height(8.dp))
                TradingViewChart(symbol = "SP:SPX", height = 320)
            }
        }

        HomerCard {
            Column(Modifier.padding(12.dp)) {
                Text("BET / ROTX", style = MaterialTheme.typography.titleSmall, color = TextMuted)
                Spacer(Modifier.height(8.dp))
                TradingViewChart(symbol = "BSE:BET", height = 320)
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TradingViewChart(symbol: String, height: Int) {
    val html = """
        <!DOCTYPE html><html>
        <head><style>body{margin:0;background:#0a1220;}</style></head>
        <body>
        <div class="tradingview-widget-container" style="height:${height}px;">
          <div id="tv_chart_container" style="height:100%;"></div>
          <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
          <script>
            new TradingView.widget({
              width: "100%", height: ${height},
              symbol: "$symbol",
              interval: "D",
              timezone: "exchange",
              theme: "dark",
              style: "1",
              locale: "en",
              toolbar_bg: "#0a1220",
              enable_publishing: false,
              hide_top_toolbar: false,
              container_id: "tv_chart_container"
            });
          </script>
        </div>
        </body></html>
    """.trimIndent()

    Box(modifier = Modifier.fillMaxWidth().height(height.dp).clip(RoundedCornerShape(12.dp))) {
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    webViewClient = WebViewClient()
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    loadDataWithBaseURL("https://s3.tradingview.com", html, "text/html", "UTF-8", null)
                }
            },
            modifier = Modifier.fillMaxSize(),
        )
    }
}
