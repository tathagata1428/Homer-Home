package ro.b4it.homer.ui.screens.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import ro.b4it.homer.data.preferences.AppPreferences
import ro.b4it.homer.data.supabase.SupabaseManager
import ro.b4it.homer.data.sync.SyncEngine
import javax.inject.Inject

data class AccountState(
    val authUser: String? = null,
    val supabaseEmail: String? = null,
    val isBogdan: Boolean = false,
    val loading: Boolean = false,
    val error: String? = null,
    val signInUsername: String = "",
    val signInPassword: String = "",
)

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val prefs: AppPreferences,
    private val supabase: SupabaseManager,
    private val sync: SyncEngine,
    private val http: OkHttpClient,
    @javax.inject.Named("homerBaseUrl") private val homerBaseUrl: String,
) : ViewModel() {

    private val _state = MutableStateFlow(AccountState())
    val state: StateFlow<AccountState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            prefs.authUser.collect { user ->
                _state.update { it.copy(authUser = user, isBogdan = supabase.isBogdan()) }
            }
        }
    }

    fun setUsername(v: String) { _state.update { it.copy(signInUsername = v, error = null) } }
    fun setPassword(v: String) { _state.update { it.copy(signInPassword = v, error = null) } }

    fun signIn() {
        val username = _state.value.signInUsername.trim()
        val pw       = _state.value.signInPassword
        if (username.isBlank() || pw.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val session = exchangeToken(username, pw)
                supabase.importSession(session.accessToken, session.refreshToken, session.expiresIn)
                prefs.setAuthUser("bogdan")
                supabase.setCachedAuthUser("bogdan")
                sync.start()
                _state.update { it.copy(loading = false, isBogdan = supabase.isBogdan()) }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Sign-in failed") }
            }
        }
    }

    private data class TokenResponse(val accessToken: String, val refreshToken: String, val expiresIn: Long)

    private suspend fun exchangeToken(username: String, password: String): TokenResponse =
        withContext(Dispatchers.IO) {
            val body = """{"action":"exchangeToken","username":"$username","password":"${password.replace("\"", "\\\"")}"}"""
            val request = Request.Builder()
                .url("$homerBaseUrl/api/auth")
                .post(body.toRequestBody("application/json".toMediaType()))
                .build()
            val response = http.newCall(request).execute()
            val json = JSONObject(response.body?.string() ?: throw Exception("Empty response"))
            if (!response.isSuccessful || json.optBoolean("ok") == false) {
                throw Exception(json.optString("error", "Authentication failed"))
            }
            TokenResponse(
                accessToken  = json.getString("access_token"),
                refreshToken = json.getString("refresh_token"),
                expiresIn    = json.getLong("expires_in"),
            )
        }

    fun signOut() {
        viewModelScope.launch {
            supabase.signOut()
            prefs.clearAuth()
            supabase.setCachedAuthUser(null)
            _state.update { it.copy(authUser = null, supabaseEmail = null, isBogdan = false) }
        }
    }
}
