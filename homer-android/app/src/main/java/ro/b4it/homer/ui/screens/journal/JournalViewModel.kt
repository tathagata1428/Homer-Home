package ro.b4it.homer.ui.screens.journal

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import ro.b4it.homer.BuildConfig
import ro.b4it.homer.data.local.dao.JournalDao
import ro.b4it.homer.data.local.entity.JournalEntry
import java.time.LocalDate
import java.time.LocalTime
import javax.inject.Inject

@HiltViewModel
class JournalViewModel @Inject constructor(
    private val dao: JournalDao,
    private val http: OkHttpClient,
) : ViewModel() {

    val entries = dao.getAll()

    private val _streak        = MutableStateFlow(0)
    val streak: StateFlow<Int> = _streak.asStateFlow()

    // Last 7 days: list of (date, dayAbbrev, moodEmoji)
    private val _weekMoods = MutableStateFlow<List<Triple<String, String, String>>>(emptyList())
    val weekMoods: StateFlow<List<Triple<String, String, String>>> = _weekMoods.asStateFlow()

    private val _prompt        = MutableStateFlow("")
    val prompt: StateFlow<String> = _prompt.asStateFlow()

    private val _promptLoading = MutableStateFlow(false)
    val promptLoading: StateFlow<Boolean> = _promptLoading.asStateFlow()

    private val json = Json { ignoreUnknownKeys = true }

    init {
        viewModelScope.launch {
            entries.collect { list ->
                _streak.value    = calculateStreak(list)
                _weekMoods.value = buildWeekMoods(list)
            }
        }
        loadPrompt()
    }

    fun loadPrompt() {
        if (_promptLoading.value) return
        _promptLoading.value = true
        viewModelScope.launch {
            try {
                val hour = LocalTime.now().hour
                val time = when { hour < 12 -> "morning"; hour < 17 -> "afternoon"; else -> "evening" }
                _prompt.value = callAI(
                    system = "You are a warm, thoughtful journaling guide.",
                    user   = "Generate one short, open-ended journaling prompt for the $time. " +
                             "It should be introspective and take 2-3 minutes to answer. " +
                             "Return ONLY the prompt text, no quotes, no preamble.",
                )
            } catch (_: Exception) {
                _prompt.value = "What's one thing you're genuinely proud of today?"
            } finally {
                _promptLoading.value = false
            }
        }
    }

    fun deleteEntry(entry: JournalEntry) {
        viewModelScope.launch { dao.delete(entry) }
    }

    private fun calculateStreak(entries: List<JournalEntry>): Int {
        val dates = entries.map { it.date }.toSet()
        var streak = 0
        var day = LocalDate.now()
        while (day.toString() in dates) { streak++; day = day.minusDays(1) }
        return streak
    }

    private fun buildWeekMoods(entries: List<JournalEntry>): List<Triple<String, String, String>> {
        val dateToMood = entries.associate { it.date to it.mood }
        val days = listOf("M", "T", "W", "T", "F", "S", "S")
        return (6 downTo 0).mapIndexed { idx, daysAgo ->
            val date  = LocalDate.now().minusDays(daysAgo.toLong())
            val abbr  = days[date.dayOfWeek.value - 1]
            Triple(date.toString(), abbr, dateToMood[date.toString()] ?: "")
        }
    }

    private suspend fun callAI(system: String, user: String): String {
        val body = buildJsonObject {
            put("model", BuildConfig.OC_MODEL)
            putJsonArray("messages") {
                addJsonObject { put("role", "system"); put("content", system) }
                addJsonObject { put("role", "user");   put("content", user)   }
            }
        }.toString()
        val isNemotron = "nemotron" in BuildConfig.OC_MODEL.lowercase()
        val nemoUrl = BuildConfig.NEMOCLAW_GATEWAY_URL.takeIf { it.isNotBlank() }
        val aiUrl   = if (isNemotron && nemoUrl != null) nemoUrl else BuildConfig.OC_GATEWAY_URL
        val aiToken = if (isNemotron && nemoUrl != null) BuildConfig.NEMOCLAW_GATEWAY_TOKEN else BuildConfig.OC_GATEWAY_TOKEN
        val req = Request.Builder()
            .url("$aiUrl/chat/completions")
            .header("Authorization", "Bearer $aiToken")
            .header("Content-Type", "application/json")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()
        val resp = withContext(Dispatchers.IO) { http.newCall(req).execute().body?.string() ?: "" }
        return json.parseToJsonElement(resp)
            .jsonObject["choices"]?.jsonArray?.firstOrNull()
            ?.jsonObject?.get("message")?.jsonObject?.get("content")
            ?.jsonPrimitive?.content?.trim() ?: ""
    }
}
