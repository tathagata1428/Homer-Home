package ro.b4it.homer.ui.screens.joey

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import ro.b4it.homer.BuildConfig
import javax.inject.Inject

data class ChatMessage(val role: String, val content: String)

@HiltViewModel
class JoeyViewModel @Inject constructor(private val http: OkHttpClient) : ViewModel() {

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    private val _input   = MutableStateFlow("")
    val input: StateFlow<String> = _input.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val json = Json { ignoreUnknownKeys = true }

    fun setInput(text: String) { _input.value = text }

    fun send() {
        val text = _input.value.trim()
        if (text.isBlank() || _loading.value) return

        val userMsg = ChatMessage("user", text)
        _messages.update { it + userMsg }
        _input.value = ""
        _loading.value = true

        viewModelScope.launch {
            try {
                val history = _messages.value.takeLast(20).map { m ->
                    mapOf("role" to m.role, "content" to m.content)
                }
                val body = json.encodeToString(
                    kotlinx.serialization.serializer(),
                    mapOf(
                        "model"    to BuildConfig.OC_MODEL,
                        "messages" to history,
                    )
                )
                val req = Request.Builder()
                    .url("${BuildConfig.OC_GATEWAY_URL}/chat/completions")
                    .header("Authorization", "Bearer ${BuildConfig.OC_GATEWAY_TOKEN}")
                    .header("Content-Type", "application/json")
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .build()

                val resp  = http.newCall(req).execute().body?.string() ?: ""
                val reply = extractContent(resp)
                _messages.update { it + ChatMessage("assistant", reply) }
            } catch (e: Exception) {
                _messages.update { it + ChatMessage("assistant", "Error: ${e.message}") }
            } finally {
                _loading.value = false
            }
        }
    }

    private fun extractContent(resp: String): String = try {
        val el = json.parseToJsonElement(resp)
        el.jsonObject["choices"]?.jsonArray?.firstOrNull()
            ?.jsonObject?.get("message")
            ?.jsonObject?.get("content")
            ?.jsonPrimitive?.content ?: "No response"
    } catch (_: Exception) { resp.take(500) }

    fun clearChat() { _messages.value = emptyList() }
}
