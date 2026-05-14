package ro.b4it.homer.data.remote

import android.util.Log
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class QuotesApi @Inject constructor(private val http: OkHttpClient) {

    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    // Same sources as the website
    private val SOURCES = listOf(
        "https://raw.githubusercontent.com/dwyl/quotes/main/quotes.json",
        "https://raw.githubusercontent.com/JamesFT/Database-Quotes-JSON/master/quotes.json",
    )

    private val HUMOR_FALLBACK = listOf(
        Quote("Why do Java developers wear glasses? Because they don't C#.", "Dev Humor"),
        Quote("There are only 10 types of people in the world.", "Binary Humor"),
        Quote("I told my wife she was drawing her eyebrows too high. She looked surprised.", "Dad Jokes"),
    )

    private val MOTIVATIONAL_FALLBACK = listOf(
        Quote("Do what you can, with what you have, where you are.", "Theodore Roosevelt"),
        Quote("The only way to do great work is to love what you do.", "Steve Jobs"),
        Quote("It does not matter how slowly you go as long as you do not stop.", "Confucius"),
    )

    suspend fun fetchAll(): List<Quote> {
        for (source in SOURCES) {
            try {
                val body = http.newCall(Request.Builder().url(source).build()).execute().body?.string()
                    ?: continue
                val arr = json.parseToJsonElement(body).jsonArray
                val quotes = arr.mapNotNull { el ->
                    val obj = el.jsonObject
                    val text   = obj["t"]?.jsonPrimitive?.content
                        ?: obj["content"]?.jsonPrimitive?.content
                        ?: obj["quoteText"]?.jsonPrimitive?.content
                        ?: return@mapNotNull null
                    val author = obj["a"]?.jsonPrimitive?.content
                        ?: obj["author"]?.jsonPrimitive?.content
                        ?: obj["quoteAuthor"]?.jsonPrimitive?.content
                        ?: "Unknown"
                    Quote(text, author)
                }
                if (quotes.isNotEmpty()) return quotes
            } catch (e: Exception) {
                Log.e("QuotesApi", "Failed to fetch from $source", e)
            }
        }
        return MOTIVATIONAL_FALLBACK
    }

    fun humorFallback() = HUMOR_FALLBACK
    fun motivationalFallback() = MOTIVATIONAL_FALLBACK
}

data class Quote(val text: String, val author: String)
