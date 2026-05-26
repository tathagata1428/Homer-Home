package ro.b4it.homer.ui.screens.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
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
    @javax.inject.Named("syncEmail") private val syncEmail: String,
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
            if (username.equals("bogdan", ignoreCase = true) && syncEmail.isNotBlank()) {
                try {
                    // Authenticate directly with Supabase — same credentials as the website.
                    supabase.signIn(syncEmail, pw)
                    prefs.setAuthUser("bogdan")
                    supabase.setCachedAuthUser("bogdan")
                    sync.start()
                    _state.update { it.copy(loading = false, isBogdan = supabase.isBogdan()) }
                } catch (e: Exception) {
                    _state.update { it.copy(loading = false, error = e.message ?: "Sign-in failed") }
                }
            } else {
                _state.update { it.copy(loading = false, error = "Invalid username or password") }
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
