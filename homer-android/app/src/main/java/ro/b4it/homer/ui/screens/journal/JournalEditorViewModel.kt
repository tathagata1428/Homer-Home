package ro.b4it.homer.ui.screens.journal

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import ro.b4it.homer.BuildConfig
import ro.b4it.homer.data.local.dao.JournalDao
import ro.b4it.homer.data.local.entity.JournalEntry
import ro.b4it.homer.data.sync.SyncEngine
import java.time.LocalDate
import java.util.UUID
import javax.inject.Inject

@Serializable
data class JournalReflection(
    val mood: String = "",
    val themes: String = "",
    val insight: String = "",
    val affirmation: String = "",
)

val MOODS = listOf(
    "😊" to "Happy",
    "🤩" to "Excited",
    "🤔" to "Reflective",
    "😔" to "Sad",
    "😰" to "Anxious",
    "😤" to "Frustrated",
)

@HiltViewModel
class JournalEditorViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val dao: JournalDao,
    private val sync: SyncEngine,
    private val http: OkHttpClient,
) : ViewModel() {

    private val entryId: String = checkNotNull(savedStateHandle["entryId"])

    private val _entry = MutableStateFlow<JournalEntry?>(null)
    val entry: StateFlow<JournalEntry?> = _entry.asStateFlow()

    private val _content = MutableStateFlow("")
    val content: StateFlow<String> = _content.asStateFlow()

    private val _mood = MutableStateFlow("")
    val mood: StateFlow<String> = _mood.asStateFlow()

    private val _moodLabel = MutableStateFlow("")
    val moodLabel: StateFlow<String> = _moodLabel.asStateFlow()

    private val _reflection = MutableStateFlow<JournalReflection?>(null)
    val reflection: StateFlow<JournalReflection?> = _reflection.asStateFlow()

    private val _reflectionLoading = MutableStateFlow(false)
    val reflectionLoading: StateFlow<Boolean> = _reflectionLoading.asStateFlow()

    private val _done = MutableStateFlow(false)
    val done: StateFlow<Boolean> = _done.asStateFlow()

    private val serialJson = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    init {
        viewModelScope.launch {
            val today = LocalDate.now().toString()
            val loaded = if (entryId == "new") {
                dao.getByDate(today) ?: JournalEntry(id = UUID.randomUUID().toString(), date = today)
            } else {
                dao.getById(entryId)
            }
            _entry.value      = loaded
            _content.value    = loaded?.content ?: ""
            _mood.value       = loaded?.mood ?: ""
            _moodLabel.value  = loaded?.moodLabel ?: ""
            if (loaded?.aiReflection?.isNotBlank() == true) {
                runCatching {
                    _reflection.value = serialJson.decodeFromString(JournalReflection.serializer(), loaded.aiReflection)
                }
            }
        }
    }

    fun setContent(text: String) { _content.value = text }

    fun setMood(emoji: String, label: String) {
        _mood.value      = emoji
        _moodLabel.value = label
    }

    fun save() {
        val current = _entry.value ?: return
        val words = _content.value.trim().split("\\s+".toRegex()).count { it.isNotBlank() }
        val updated = current.copy(
            content      = _content.value.trim(),
            mood         = _mood.value,
            moodLabel    = _moodLabel.value,
            aiReflection = _reflection.value?.let {
                serialJson.encodeToString(JournalReflection.serializer(), it)
            } ?: current.aiReflection,
            wordCount    = words,
            updatedAt    = System.currentTimeMillis(),
        )
        viewModelScope.launch {
            dao.upsert(updated)
            _entry.value = updated
            sync.pushJournalDebounced()
            _done.value  = true
        }
    }

    fun deleteEntry() {
        val current = _entry.value ?: run { _done.value = true; return }
        viewModelScope.launch { dao.delete(current); sync.pushJournalDebounced(); _done.value = true }
    }

    fun getReflection() {
        val text = _content.value.trim()
        if (text.length < 20 || _reflectionLoading.value) return
        _reflectionLoading.value = true
        viewModelScope.launch {
            try {
                val raw = callAI(
                    system = """You are an empathetic journaling coach. Analyze the journal entry and respond ONLY with a JSON object with these exact keys:
{"mood": "one of Happy/Excited/Reflective/Sad/Anxious/Frustrated",
 "themes": "2-4 key themes as comma-separated words",
 "insight": "one thoughtful observation in 1-2 sentences",
 "affirmation": "one warm, personal affirmation in 1 sentence"}""",
                    user = text,
                )
                // Extract JSON even if wrapped in markdown code fences
                val jsonStr = Regex("""\{[\s\S]*\}""").find(raw)?.value ?: raw
                _reflection.value = serialJson.decodeFromString(JournalReflection.serializer(), jsonStr)

                // Auto-set mood from AI if user hasn't picked one
                if (_mood.value.isBlank()) {
                    val aiMoodLabel = _reflection.value?.mood ?: ""
                    MOODS.firstOrNull { it.second == aiMoodLabel }?.let { (emoji, label) ->
                        _mood.value      = emoji
                        _moodLabel.value = label
                    }
                }
            } catch (_: Exception) {
                _reflection.value = JournalReflection(
                    insight     = "Unable to generate reflection right now.",
                    affirmation = "Keep writing — every word matters.",
                )
            } finally {
                _reflectionLoading.value = false
            }
        }
    }

    private suspend fun callAI(system: String, user: String): String {
        val model = BuildConfig.OC_MODEL
        val isNemotron = model.contains("nemotron", ignoreCase = true)
        val gatewayUrl = if (isNemotron && BuildConfig.NEMOCLAW_GATEWAY_URL.isNotBlank())
            BuildConfig.NEMOCLAW_GATEWAY_URL else BuildConfig.OC_GATEWAY_URL
        val gatewayToken = if (isNemotron && BuildConfig.NEMOCLAW_GATEWAY_TOKEN.isNotBlank())
            BuildConfig.NEMOCLAW_GATEWAY_TOKEN else BuildConfig.OC_GATEWAY_TOKEN

        val body = buildJsonObject {
            put("model", model)
            putJsonArray("messages") {
                addJsonObject { put("role", "system"); put("content", system) }
                addJsonObject { put("role", "user");   put("content", user)   }
            }
        }.toString()
        val req = Request.Builder()
            .url("$gatewayUrl/chat/completions")
            .header("Authorization", "Bearer $gatewayToken")
            .header("Content-Type", "application/json")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()
        val resp = withContext(Dispatchers.IO) { http.newCall(req).execute().body?.string() ?: "" }
        return serialJson.parseToJsonElement(resp)
            .jsonObject["choices"]?.jsonArray?.firstOrNull()
            ?.jsonObject?.get("message")?.jsonObject?.get("content")
            ?.jsonPrimitive?.content?.trim() ?: ""
    }
}
