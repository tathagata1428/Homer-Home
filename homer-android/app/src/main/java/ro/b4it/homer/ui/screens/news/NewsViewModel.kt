package ro.b4it.homer.ui.screens.news

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import org.xmlpull.v1.XmlPullParser
import android.util.Xml
import ro.b4it.homer.BuildConfig
import javax.inject.Inject

data class NewsArticle(
    val title: String, val description: String, val link: String,
    val source: String, val pubDate: String,
)

data class NewsState(
    val region: String = "Romania",
    val source: String = "Digi24",
    val articles: List<NewsArticle> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
    val availableRegions: List<String> = listOf("Romania", "International"),
    val availableSources: List<String> = emptyList(),
)

private val RSS_SOURCES = mapOf(
    "Romania" to mapOf(
        "Digi24"      to "https://www.digi24.ro/rss",
        "ProTV"       to "https://stirileprotv.ro/rss",
        "G4Media"     to "https://www.g4media.ro/feed",
        "HotNews"     to "https://www.hotnews.ro/rss",
    ),
    "International" to mapOf(
        "BBC World"   to "http://feeds.bbci.co.uk/news/world/rss.xml",
        "Reuters"     to "https://feeds.reuters.com/reuters/topNews",
        "The Guardian" to "https://www.theguardian.com/world/rss",
        "Al Jazeera"  to "https://www.aljazeera.com/xml/rss/all.xml",
    ),
)

@HiltViewModel
class NewsViewModel @Inject constructor(private val http: OkHttpClient) : ViewModel() {

    private val _state = MutableStateFlow(NewsState())
    val state: StateFlow<NewsState> = _state.asStateFlow()

    init {
        updateSources("Romania")
        loadFeed()
    }

    fun setRegion(region: String) {
        _state.update { it.copy(region = region) }
        val sources = RSS_SOURCES[region]?.keys?.toList() ?: emptyList()
        _state.update { it.copy(availableSources = sources, source = sources.firstOrNull() ?: "") }
        loadFeed()
    }

    fun setSource(src: String) {
        _state.update { it.copy(source = src) }
        loadFeed()
    }

    fun refresh() = loadFeed()

    private fun updateSources(region: String) {
        val sources = RSS_SOURCES[region]?.keys?.toList() ?: emptyList()
        _state.update { it.copy(availableSources = sources, source = sources.firstOrNull() ?: "") }
    }

    private fun loadFeed() {
        val s   = _state.value
        val url = RSS_SOURCES[s.region]?.get(s.source) ?: return
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val xml = http.newCall(Request.Builder().url(url).build()).execute().body?.string() ?: ""
                val articles = parseRss(xml, s.source)
                _state.update { it.copy(articles = articles, loading = false) }
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message, loading = false) }
            }
        }
    }

    private fun parseRss(xml: String, sourceName: String): List<NewsArticle> {
        val articles = mutableListOf<NewsArticle>()
        try {
            val parser: XmlPullParser = Xml.newPullParser()
            parser.setInput(xml.reader())
            var title = ""; var desc = ""; var link = ""; var pub = ""
            var inItem = false
            var event = parser.eventType
            while (event != XmlPullParser.END_DOCUMENT) {
                when (event) {
                    XmlPullParser.START_TAG -> when (parser.name) {
                        "item" -> { inItem = true; title=""; desc=""; link=""; pub="" }
                        "title"       -> if (inItem) title = parser.nextText()
                        "description" -> if (inItem) desc  = parser.nextText().replace(Regex("<[^>]*>"), "")
                        "link"        -> if (inItem) link  = parser.nextText()
                        "pubDate"     -> if (inItem) pub   = parser.nextText().take(16)
                    }
                    XmlPullParser.END_TAG -> if (parser.name == "item" && inItem) {
                        articles.add(NewsArticle(title, desc, link, sourceName, pub))
                        inItem = false
                    }
                }
                event = parser.next()
            }
        } catch (_: Exception) { }
        return articles
    }
}
