package ro.b4it.homer.ui.screens.countdown

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import ro.b4it.homer.BuildConfig
import javax.inject.Inject

enum class CommentaryMode(val id: String, val label: String, val emoji: String) {
    SARCASTIC   ("sarcastic",    "Sarcastic",    "😏"),
    MOTIVATIONAL("motivational", "Motivational", "💪"),
    DRAMA       ("drama",        "Drama Queen",  "👸"),
    STOIC       ("stoic",        "Stoic Sage",   "🧘"),
    CHAOTIC     ("chaotic",      "Chaotic",      "🦄"),
}

data class CountdownTick(
    val hasEvent: Boolean = false,
    val isPast:   Boolean = false,
    val days:     Long    = 0,
    val hours:    Long    = 0,
    val mins:     Long    = 0,
    val secs:     Long    = 0,
)

@HiltViewModel
class CountdownViewModel @Inject constructor(
    @ApplicationContext private val ctx: Context,
    private val http: OkHttpClient,
) : ViewModel() {

    private val _eventName    = MutableStateFlow("")
    val eventName: StateFlow<String> = _eventName.asStateFlow()

    private val _eventDateMs  = MutableStateFlow(0L)
    val eventDateMs: StateFlow<Long> = _eventDateMs.asStateFlow()

    private val _mode         = MutableStateFlow(CommentaryMode.SARCASTIC)
    val mode: StateFlow<CommentaryMode> = _mode.asStateFlow()

    private val _tick         = MutableStateFlow(CountdownTick())
    val tick: StateFlow<CountdownTick> = _tick.asStateFlow()

    private val _commentary   = MutableStateFlow("")
    val commentary: StateFlow<String> = _commentary.asStateFlow()

    private val _loading      = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private var commentaryJob: Job? = null
    private val json = Json { ignoreUnknownKeys = true }

    init {
        loadConfig()
        // 1-second ticker
        viewModelScope.launch {
            while (true) {
                updateTick()
                delay(1000L)
            }
        }
        // Auto-generate when mode changes (skip initial value)
        viewModelScope.launch {
            var first = true
            _mode.collect {
                if (first) { first = false; return@collect }
                if (_eventDateMs.value > 0L) generateCommentary()
            }
        }
    }

    fun setEvent(name: String, dateMs: Long) {
        _eventName.value   = name
        _eventDateMs.value = dateMs
        updateTick()
        saveConfig()
        generateCommentary()
    }

    fun setMode(m: CommentaryMode) {
        _mode.value = m
        saveConfig()
        // commentary auto-generated via collect above
    }

    fun generateCommentary() {
        if (_eventDateMs.value == 0L) return
        commentaryJob?.cancel()
        commentaryJob = viewModelScope.launch {
            _loading.value    = true
            _commentary.value = ""
            try {
                val prompt = buildPrompt()
                val isNemotron = "nemotron" in BuildConfig.OC_MODEL.lowercase()
                val nemoUrl    = BuildConfig.NEMOCLAW_GATEWAY_URL.takeIf { it.isNotBlank() }
                val gatewayUrl = if (isNemotron && nemoUrl != null) nemoUrl else BuildConfig.OC_GATEWAY_URL
                val gatewayTok = if (isNemotron && nemoUrl != null) BuildConfig.NEMOCLAW_GATEWAY_TOKEN else BuildConfig.OC_GATEWAY_TOKEN

                val body = buildJsonObject {
                    put("model", BuildConfig.OC_MODEL)
                    putJsonArray("messages") {
                        addJsonObject {
                            put("role", "system")
                            put("content",
                                "You are a sharp, concise writer for a personal dashboard widget. " +
                                "Follow the tone instruction exactly. No disclaimers, no meta-commentary, no preamble.")
                        }
                        addJsonObject {
                            put("role", "user")
                            put("content", prompt)
                        }
                    }
                }.toString()

                val req = Request.Builder()
                    .url("$gatewayUrl/chat/completions")
                    .header("Authorization", "Bearer $gatewayTok")
                    .header("Content-Type", "application/json")
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .build()

                val respBody = withContext(Dispatchers.IO) {
                    http.newCall(req).execute().body?.string() ?: ""
                }

                val content = try {
                    json.parseToJsonElement(respBody)
                        .jsonObject["choices"]?.jsonArray?.firstOrNull()
                        ?.jsonObject?.get("message")?.jsonObject?.get("content")
                        ?.jsonPrimitive?.content
                } catch (_: Exception) { null }

                _commentary.value = content?.trim().takeIf { !it.isNullOrBlank() }
                    ?: "Joey is unavailable right now."
            } catch (e: Exception) {
                _commentary.value = "Couldn't reach Joey \u2014 ${e.message?.take(60)}"
            } finally {
                _loading.value = false
            }
        }
    }

    private fun buildPrompt(): String {
        val name = _eventName.value.ifBlank { "an upcoming event" }
        val diff = _eventDateMs.value - System.currentTimeMillis()
        val timeStr = if (diff <= 0) "it has already passed" else {
            val d = diff / 86400000
            val h = (diff % 86400000) / 3600000
            val m = (diff % 3600000) / 60000
            "$d days, $h hours, $m minutes"
        }
        val tone = when (_mode.value) {
            CommentaryMode.SARCASTIC    ->
                "dry, sarcastic, slightly nihilistic. Mock the absurdity of counting down days. Be witty but not cruel."
            CommentaryMode.MOTIVATIONAL ->
                "warm, healing, and genuinely motivational. Acknowledge the wait and reframe it as growth."
            CommentaryMode.DRAMA        ->
                "a full-blown drama queen — theatrical, over the top, soap-opera intense. Make it hilariously extra."
            CommentaryMode.STOIC        ->
                "a stoic philosopher. Brief, profound, detached. Marcus Aurelius energy. Quote-worthy."
            CommentaryMode.CHAOTIC      ->
                "chaotic and unhinged. Random tangents, weird energy, fourth-wall breaks. Funny and unpredictable."
        }
        return "Someone is counting down to \"$name\". Time remaining: $timeStr. " +
               "Write one punchy comment (1–3 sentences, max 50 words) in the voice of $tone " +
               "Output only the comment — no quotes around it, no preamble, no labels."
    }

    private fun updateTick() {
        val target = _eventDateMs.value
        if (target == 0L) { _tick.value = CountdownTick(); return }
        val diff = target - System.currentTimeMillis()
        if (diff <= 0) { _tick.value = CountdownTick(hasEvent = true, isPast = true); return }
        _tick.value = CountdownTick(
            hasEvent = true,
            isPast   = false,
            days     = diff / 86400000,
            hours    = (diff % 86400000) / 3600000,
            mins     = (diff % 3600000)  / 60000,
            secs     = (diff % 60000)    / 1000,
        )
    }

    private fun loadConfig() {
        val sp = ctx.getSharedPreferences("homer_countdown", Context.MODE_PRIVATE)
        _eventName.value   = sp.getString("name",  "")  ?: ""
        _eventDateMs.value = sp.getLong("dateMs", 0L)
        val modeId = sp.getString("mode", CommentaryMode.SARCASTIC.id) ?: CommentaryMode.SARCASTIC.id
        _mode.value = CommentaryMode.entries.find { it.id == modeId } ?: CommentaryMode.SARCASTIC
        updateTick()
    }

    private fun saveConfig() {
        ctx.getSharedPreferences("homer_countdown", Context.MODE_PRIVATE).edit()
            .putString("name",   _eventName.value)
            .putLong("dateMs",   _eventDateMs.value)
            .putString("mode",   _mode.value.id)
            .apply()
    }
}
