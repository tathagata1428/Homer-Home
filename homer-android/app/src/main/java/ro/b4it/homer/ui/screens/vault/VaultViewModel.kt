package ro.b4it.homer.ui.screens.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ro.b4it.homer.data.preferences.AppPreferences
import javax.inject.Inject

/**
 * VaultViewModel manages vault mode (personal/work).
 *
 * Android vault is a UI section gate only — Room data is stored unencrypted.
 * No separate vault password: the account login is the only auth gate.
 */
@HiltViewModel
class VaultViewModel @Inject constructor(private val prefs: AppPreferences) : ViewModel() {

    val vaultMode: StateFlow<String> = prefs.vaultMode
        .stateIn(viewModelScope, SharingStarted.Eagerly, "personal")

    fun toggleMode() {
        viewModelScope.launch {
            val cur = prefs.vaultMode.firstOrNull() ?: "personal"
            prefs.set(AppPreferences.KEY_VAULT_MODE, if (cur == "personal") "work" else "personal")
        }
    }
}
