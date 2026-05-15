package ro.b4it.homer.ui.screens.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import io.github.jan.supabase.auth.auth
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
    val signInEmail: String = "",
    val signInPassword: String = "",
)

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val prefs: AppPreferences,
    private val supabase: SupabaseManager,
    private val sync: SyncEngine,
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

    fun setEmail(v: String) { _state.update { it.copy(signInEmail = v, error = null) } }
    fun setPassword(v: String) { _state.update { it.copy(signInPassword = v, error = null) } }

    fun signIn() {
        val email = _state.value.signInEmail.trim()
        val pw    = _state.value.signInPassword
        if (email.isBlank() || pw.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                supabase.signIn(email, pw)
                val sessionEmail = try { supabase.client.auth.currentUserOrNull()?.email } catch (_: Exception) { null }
                prefs.setAuthUser(sessionEmail?.substringBefore("@") ?: email.substringBefore("@"))
                supabase.setCachedAuthUser(sessionEmail?.substringBefore("@"))
                sync.start()
                _state.update { it.copy(loading = false, supabaseEmail = sessionEmail, isBogdan = supabase.isBogdan()) }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Sign in failed") }
            }
        }
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
