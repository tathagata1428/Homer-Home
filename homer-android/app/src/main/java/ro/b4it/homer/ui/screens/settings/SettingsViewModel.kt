package ro.b4it.homer.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ro.b4it.homer.data.preferences.AppPreferences
import javax.inject.Inject

data class SettingsState(
    val focusMin: Int = 25,
    val shortMin: Int = 5,
    val longMin: Int = 15,
    val autoStart: Boolean = false,
    val notifications: Boolean = true,
    val sfx: Boolean = true,
)

@HiltViewModel
class SettingsViewModel @Inject constructor(private val prefs: AppPreferences) : ViewModel() {

    val state: StateFlow<SettingsState> = combine(
        prefs.pomoFocus,
        prefs.pomoShort,
        prefs.pomoLong,
        prefs.pomoAutoStart,
        prefs.pomoNotif,
    ) { focus, short, long, auto, notif ->
        SettingsState(
            focusMin      = focus,
            shortMin      = short,
            longMin       = long,
            autoStart     = auto,
            notifications = notif,
        )
    }.combine(prefs.pomoSfx) { s, sfx -> s.copy(sfx = sfx) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SettingsState())

    fun setFocusMin(v: Int)      { viewModelScope.launch { prefs.set(AppPreferences.KEY_POMO_FOCUS,     v) } }
    fun setShortMin(v: Int)      { viewModelScope.launch { prefs.set(AppPreferences.KEY_POMO_SHORT,     v) } }
    fun setLongMin(v: Int)       { viewModelScope.launch { prefs.set(AppPreferences.KEY_POMO_LONG,      v) } }
    fun setAutoStart(v: Boolean) { viewModelScope.launch { prefs.set(AppPreferences.KEY_POMO_AUTOSTART, v) } }
    fun setNotifications(v: Boolean) { viewModelScope.launch { prefs.set(AppPreferences.KEY_POMO_NOTIF, v) } }
    fun setSfx(v: Boolean)       { viewModelScope.launch { prefs.set(AppPreferences.KEY_POMO_SFX,       v) } }
}
