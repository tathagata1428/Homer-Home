package ro.b4it.homer.ui.screens.joey

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import ro.b4it.homer.BuildConfig
import ro.b4it.homer.data.preferences.AppPreferences
import javax.inject.Inject

data class ChatMessage(val role: String, val content: String)

@HiltViewModel
class JoeyViewModel @Inject constructor(
    private val http: OkHttpClient,
    private val prefs: AppPreferences,
) : ViewModel() {

    /** Separate history per mode, matching the website's per-mode memory. */
    private val personalHistory = mutableListOf<ChatMessage>()
    private val workHistory     = mutableListOf<ChatMessage>()

    private val _mode    = MutableStateFlow("personal")   // "personal" | "work"
    val mode: StateFlow<String> = _mode.asStateFlow()

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    private val _input   = MutableStateFlow("")
    val input: StateFlow<String> = _input.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val json = Json { ignoreUnknownKeys = true }

    init {
        // Sync mode with vault mode preference
        viewModelScope.launch {
            prefs.vaultMode.collect { vaultMode ->
                if (_mode.value != vaultMode) switchMode(vaultMode)
            }
        }
    }

    fun setInput(text: String) { _input.value = text }

    fun toggleMode() {
        val next = if (_mode.value == "personal") "work" else "personal"
        viewModelScope.launch { prefs.set(AppPreferences.KEY_VAULT_MODE, next) }
        switchMode(next)
    }

    private fun switchMode(mode: String) {
        _mode.value = mode
        _messages.value = currentHistory().toList()
    }

    private fun currentHistory() = if (_mode.value == "work") workHistory else personalHistory

    fun send() {
        val text = _input.value.trim()
        if (text.isBlank() || _loading.value) return

        val userMsg = ChatMessage("user", text)
        currentHistory().add(userMsg)
        _messages.value = currentHistory().toList()
        _input.value = ""
        _loading.value = true

        viewModelScope.launch {
            try {
                val systemPrompt = buildSystemPrompt(_mode.value)
                val messages = buildList {
                    add(mapOf("role" to "system", "content" to systemPrompt))
                    addAll(currentHistory().takeLast(20).map { m ->
                        mapOf("role" to m.role, "content" to m.content)
                    })
                }
                val body = buildJsonObject {
                    put("model", BuildConfig.OC_MODEL)
                    putJsonArray("messages") {
                        messages.forEach { msg ->
                            addJsonObject {
                                put("role", msg["role"] ?: "")
                                put("content", msg["content"] ?: "")
                            }
                        }
                    }
                }.toString()
                val isNemotron = "nemotron" in BuildConfig.OC_MODEL.lowercase()
                val nemoUrl = BuildConfig.NEMOCLAW_GATEWAY_URL.takeIf { it.isNotBlank() }
                val effectiveUrl   = if (isNemotron && nemoUrl != null) nemoUrl else BuildConfig.OC_GATEWAY_URL
                val effectiveToken = if (isNemotron && nemoUrl != null) BuildConfig.NEMOCLAW_GATEWAY_TOKEN else BuildConfig.OC_GATEWAY_TOKEN
                val req = Request.Builder()
                    .url("$effectiveUrl/chat/completions")
                    .header("Authorization", "Bearer $effectiveToken")
                    .header("Content-Type", "application/json")
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .build()

                val resp  = withContext(Dispatchers.IO) {
                    http.newCall(req).execute().body?.string() ?: ""
                }
                val reply = extractContent(resp)
                val assistantMsg = ChatMessage("assistant", reply)
                currentHistory().add(assistantMsg)
                _messages.value = currentHistory().toList()
            } catch (e: Exception) {
                val errMsg = ChatMessage("assistant", "Error: ${e.message}")
                currentHistory().add(errMsg)
                _messages.value = currentHistory().toList()
            } finally {
                _loading.value = false
            }
        }
    }

    private fun buildSystemPrompt(mode: String): String = when (mode) {
        "work" -> """You are Joey, a sharp work assistant. You help with professional tasks, project management, code, writing, and work goals. Be concise, direct, and practical. Current mode: Work."""
        else   -> """You are Joey, a helpful personal assistant. You help with daily tasks, habits, goals, motivation, and personal planning. Be warm, encouraging, and practical. Current mode: Personal."""
    }

    private fun extractContent(resp: String): String = try {
        val el = json.parseToJsonElement(resp)
        el.jsonObject["choices"]?.jsonArray?.firstOrNull()
            ?.jsonObject?.get("message")
            ?.jsonObject?.get("content")
            ?.jsonPrimitive?.content ?: "No response"
    } catch (_: Exception) { resp.take(500) }

    fun clearChat() {
        currentHistory().clear()
        _messages.value = emptyList()
    }
}
