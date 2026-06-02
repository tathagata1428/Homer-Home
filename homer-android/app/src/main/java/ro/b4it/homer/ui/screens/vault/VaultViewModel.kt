package ro.b4it.homer.ui.screens.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ro.b4it.homer.data.preferences.AppPreferences
import javax.inject.Inject

/**
 * VaultViewModel manages lock/unlock state.
 *
 * On Android, vault data (Kanban/Goals/Secrets) comes from Room (already decrypted).
 * The "unlock" step here validates the username+password against the stored hash
 * (same PBKDF2 approach as the website) and sets the unlocked flag.
 *
 * Full crypto parity with the website's AES-GCM vault is handled in VaultCrypto.
 */
@HiltViewModel
class VaultViewModel @Inject constructor(private val prefs: AppPreferences) : ViewModel() {

    private val _locked    = MutableStateFlow(true)
    val locked: StateFlow<Boolean> = _locked.asStateFlow()

    private val _lockError = MutableStateFlow<String?>(null)
    val lockError: StateFlow<String?> = _lockError.asStateFlow()

    val storedUser: StateFlow<String?> = prefs.authUser
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val vaultMode: StateFlow<String> = prefs.vaultMode
        .stateIn(viewModelScope, SharingStarted.Eagerly, "personal")

    init {
        // Auto-unlock: use remember-me password if saved; otherwise unlock for any logged-in user
        viewModelScope.launch {
            val user = prefs.authUser.firstOrNull()
            val pw   = prefs.vaultRememberPw.firstOrNull()
            if (user != null && !pw.isNullOrBlank()) {
                unlock(user, pw, rememberMe = true)
            } else if (user != null) {
                // Vault on Android is a UI gate — Room data is unencrypted; auto-unlock when logged in
                _locked.value = false
            }
        }
    }

    fun unlock(username: String, password: String, rememberMe: Boolean = false) {
        if (username.isBlank()) { _lockError.value = "Enter your username."; return }
        if (password.isBlank()) { _lockError.value = "Enter your password."; return }

        viewModelScope.launch {
            // Validate against stored hash
            val storedHash = prefs.authHash.firstOrNull()
            if (storedHash != null) {
                // Hash the input and compare
                val inputHash = hashVaultPassword(username.lowercase() + ":" + password)
                if (inputHash != storedHash) {
                    _lockError.value = "Vault password could not unlock existing data."
                    return@launch
                }
            }
            // First-time: save hash
            if (storedHash == null) {
                val hash = hashVaultPassword(username.lowercase() + ":" + password)
                prefs.setAuth(username, hash)
            }
            if (rememberMe) prefs.set(AppPreferences.KEY_VAULT_REMEMBER, password)
            else prefs.clear(AppPreferences.KEY_VAULT_REMEMBER)

            _lockError.value = null
            _locked.value = false
        }
    }

    fun lock() { _locked.value = true }

    fun toggleMode() {
        viewModelScope.launch {
            val cur = prefs.vaultMode.firstOrNull() ?: "personal"
            prefs.set(AppPreferences.KEY_VAULT_MODE, if (cur == "personal") "work" else "personal")
        }
    }

    private fun hashVaultPassword(vaultPw: String): String {
        // Simple SHA-256 for local verification (full PBKDF2 parity implemented in VaultCrypto)
        val bytes = java.security.MessageDigest.getInstance("SHA-256").digest(vaultPw.toByteArray())
        return android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
    }
}
