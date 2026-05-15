package ro.b4it.homer.data.remote

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class QuotesApi @Inject constructor(private val http: OkHttpClient) {

    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    // Small, fast, reliable API first — type.fit returns ~1500 quotes as plain array
    // dwyl as secondary (large file, may be slow)
    private val SOURCES = listOf(
        "https://type.fit/api/quotes",
        "https://raw.githubusercontent.com/dwyl/quotes/main/quotes.json",
    )

    private val HUMOR_FALLBACK = listOf(
        Quote("Why do Java developers wear glasses? Because they don't C#.", "Dev Humor"),
        Quote("There are only 10 types of people in the world: those who understand binary and those who don't.", "Binary Humor"),
        Quote("I told my wife she was drawing her eyebrows too high. She looked surprised.", "Dad Jokes"),
        Quote("A SQL query walks into a bar, walks up to two tables and asks... Can I join you?", "Dev Humor"),
        Quote("Why do programmers prefer dark mode? Because light attracts bugs.", "Dev Humor"),
        Quote("To understand recursion, you must first understand recursion.", "Dev Wisdom"),
    )

    private val MOTIVATIONAL_FALLBACK = listOf(
        Quote("Do what you can, with what you have, where you are.", "Theodore Roosevelt"),
        Quote("The only way to do great work is to love what you do.", "Steve Jobs"),
        Quote("It does not matter how slowly you go as long as you do not stop.", "Confucius"),
        Quote("In the middle of every difficulty lies opportunity.", "Albert Einstein"),
        Quote("Life is what happens when you're busy making other plans.", "John Lennon"),
        Quote("The future belongs to those who believe in the beauty of their dreams.", "Eleanor Roosevelt"),
        Quote("Strive not to be a success, but rather to be of value.", "Albert Einstein"),
        Quote("I have not failed. I've just found 10,000 ways that won't work.", "Thomas Edison"),
        Quote("The only impossible journey is the one you never begin.", "Tony Robbins"),
        Quote("You miss 100% of the shots you don't take.", "Wayne Gretzky"),
        Quote("Whether you think you can or you think you can't, you're right.", "Henry Ford"),
        Quote("The secret of getting ahead is getting started.", "Mark Twain"),
        Quote("It always seems impossible until it's done.", "Nelson Mandela"),
        Quote("Dream big and dare to fail.", "Norman Vaughan"),
        Quote("You only live once, but if you do it right, once is enough.", "Mae West"),
        Quote("The purpose of our lives is to be happy.", "Dalai Lama"),
        Quote("Get busy living or get busy dying.", "Stephen King"),
        Quote("Life is not measured by the number of breaths we take, but by the moments that take our breath away.", "Maya Angelou"),
        Quote("Many of life's failures are people who did not realize how close they were to success when they gave up.", "Thomas Edison"),
        Quote("Success is not final, failure is not fatal: it is the courage to continue that counts.", "Winston Churchill"),
        Quote("The only person you are destined to become is the person you decide to be.", "Ralph Waldo Emerson"),
        Quote("Be yourself; everyone else is already taken.", "Oscar Wilde"),
        Quote("Two things are infinite: the universe and human stupidity; and I'm not sure about the universe.", "Albert Einstein"),
        Quote("You've gotta dance like there's nobody watching, love like you'll never be hurt.", "William W. Purkey"),
        Quote("We accept the love we think we deserve.", "Stephen Chbosky"),
        Quote("To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.", "Ralph Waldo Emerson"),
        Quote("In three words I can sum up everything I've learned about life: it goes on.", "Robert Frost"),
        Quote("If you tell the truth, you don't have to remember anything.", "Mark Twain"),
        Quote("A friend is someone who knows all about you and still loves you.", "Elbert Hubbard"),
        Quote("Always forgive your enemies; nothing annoys them so much.", "Oscar Wilde"),
        Quote("To live is the rarest thing in the world. Most people exist, that is all.", "Oscar Wilde"),
        Quote("The unexamined life is not worth living.", "Socrates"),
        Quote("Spread love everywhere you go. Let no one ever come to you without leaving happier.", "Mother Teresa"),
        Quote("When you reach the end of your rope, tie a knot in it and hang on.", "Franklin D. Roosevelt"),
        Quote("Always remember that you are absolutely unique. Just like everyone else.", "Margaret Mead"),
        Quote("Don't go around saying the world owes you a living. The world owes you nothing. It was here first.", "Mark Twain"),
        Quote("You only live once, but if you do it right, once is enough.", "Mae West"),
        Quote("No act of kindness, no matter how small, is ever wasted.", "Aesop"),
        Quote("We know what we are, but know not what we may be.", "William Shakespeare"),
        Quote("The best time to plant a tree was 20 years ago. The second best time is now.", "Chinese Proverb"),
        Quote("An unexamined life is not worth living.", "Socrates"),
        Quote("Spread love everywhere you go.", "Mother Teresa"),
        Quote("When you reach the end of your rope, tie a knot and hang on.", "Abraham Lincoln"),
        Quote("First, solve the problem. Then, write the code.", "John Johnson"),
        Quote("Simplicity is the soul of efficiency.", "Austin Freeman"),
        Quote("Make it work, make it right, make it fast.", "Kent Beck"),
        Quote("Code is like humor. When you have to explain it, it's bad.", "Cory House"),
        Quote("Experience is the name everyone gives to their mistakes.", "Oscar Wilde"),
        Quote("It's not a bug — it's an undocumented feature.", "Anonymous"),
        Quote("The best error message is the one that never shows up.", "Thomas Fuchs"),
    )

    suspend fun fetchAll(): List<Quote> = withContext(Dispatchers.IO) {
        // Use a short timeout so we fall back quickly if the source is unreachable
        val client = http.newBuilder()
            .connectTimeout(6, TimeUnit.SECONDS)
            .readTimeout(12, TimeUnit.SECONDS)
            .build()

        for (source in SOURCES) {
            try {
                val body = client.newCall(Request.Builder().url(source).build())
                    .execute().body?.string() ?: continue
                if (body.length < 100) continue  // suspiciously short — skip

                val arr = json.parseToJsonElement(body).jsonArray
                val quotes = arr.mapNotNull { el ->
                    try {
                        val obj = el.jsonObject
                        val text = obj["t"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
                            ?: obj["text"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
                            ?: obj["q"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
                            ?: obj["content"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
                            ?: obj["quoteText"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
                            ?: return@mapNotNull null
                        val author = obj["a"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
                            ?: obj["author"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
                            ?: obj["quoteAuthor"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
                            ?: "Unknown"
                        Quote(text.trim(), author.trim())
                    } catch (_: Exception) { null }
                }
                Log.d("QuotesApi", "Loaded ${quotes.size} quotes from $source")
                if (quotes.size >= 10) return@withContext quotes
            } catch (e: Exception) {
                Log.e("QuotesApi", "Failed to fetch from $source: ${e.message}")
            }
        }
        Log.w("QuotesApi", "All sources failed — using built-in fallback (${MOTIVATIONAL_FALLBACK.size} quotes)")
        MOTIVATIONAL_FALLBACK
    }

    fun humorFallback() = HUMOR_FALLBACK
    fun motivationalFallback() = MOTIVATIONAL_FALLBACK
}

data class Quote(val text: String, val author: String)
