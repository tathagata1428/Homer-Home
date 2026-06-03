package ro.b4it.homer.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "homer_prefs")

@Singleton
class AppPreferences @Inject constructor(@ApplicationContext private val ctx: Context) {

    private val store = ctx.dataStore

    // ---- Keys ----
    companion object {
        val KEY_AUTH_USER      = stringPreferencesKey("homer-auth-user")
        val KEY_AUTH_HASH      = stringPreferencesKey("homer-auth-hash")
        val KEY_VAULT_MODE     = stringPreferencesKey("homer-vault-mode")       // "personal" | "work"
        val KEY_VAULT_REMEMBER = stringPreferencesKey("homer-vault-remember-pw")

        val KEY_POMO_FOCUS     = intPreferencesKey("homer-pomo-focus")           // minutes
        val KEY_POMO_SHORT     = intPreferencesKey("homer-pomo-short")
        val KEY_POMO_LONG      = intPreferencesKey("homer-pomo-long")
        val KEY_POMO_AUTOSTART = booleanPreferencesKey("homer-pomo-autostart")
        val KEY_POMO_NOTIF     = booleanPreferencesKey("homer-pomo-notif")
        val KEY_POMO_VOICE     = booleanPreferencesKey("homer-pomo-voice")
        val KEY_POMO_SFX       = booleanPreferencesKey("homer-pomo-sfx")

        val KEY_CALENDAR_ICS   = stringPreferencesKey("homer-calendar-ics-url")
        val KEY_SIDEBAR_COLLAPSED = booleanPreferencesKey("homer-sidebar-collapsed")
        val KEY_LAST_TAB       = stringPreferencesKey("homer-last-tab")

        // Supabase sync timestamps (bogdan only)
        val KEY_VAULT_SUPA_TS  = longPreferencesKey("homer-vault-supa-ts")
        val KEY_LOCAL_SAVE_TS  = longPreferencesKey("homer-local-save-ts")
        val KEY_FIELD_SYNC_VER = longPreferencesKey("homer-field-sync-version")
    }

    // ---- Convenience getters ----
    val authUser: Flow<String?>  = store.data.map { it[KEY_AUTH_USER] }
    val authHash: Flow<String?>  = store.data.map { it[KEY_AUTH_HASH] }
    val vaultMode: Flow<String>  = store.data.map { it[KEY_VAULT_MODE] ?: "personal" }
    val vaultRememberPw: Flow<String?> = store.data.map { it[KEY_VAULT_REMEMBER] }

    val pomoFocus:  Flow<Int>     = store.data.map { it[KEY_POMO_FOCUS]     ?: 25 }
    val pomoShort:  Flow<Int>     = store.data.map { it[KEY_POMO_SHORT]     ?: 5  }
    val pomoLong:   Flow<Int>     = store.data.map { it[KEY_POMO_LONG]      ?: 15 }
    val pomoAutoStart: Flow<Boolean> = store.data.map { it[KEY_POMO_AUTOSTART] ?: false }
    val pomoNotif:  Flow<Boolean> = store.data.map { it[KEY_POMO_NOTIF]     ?: true  }
    val pomoVoice:  Flow<Boolean> = store.data.map { it[KEY_POMO_VOICE]     ?: false }
    val pomoSfx:    Flow<Boolean> = store.data.map { it[KEY_POMO_SFX]       ?: true  }

    val calendarIcs: Flow<String?> = store.data.map { it[KEY_CALENDAR_ICS] }

    // ---- Generic setters ----
    suspend fun <T> set(key: Preferences.Key<T>, value: T) {
        store.edit { it[key] = value }
    }

    suspend fun <T> clear(key: Preferences.Key<T>) {
        store.edit { it.remove(key) }
    }

    suspend fun setAuthUser(user: String?) {
        store.edit { prefs ->
            if (user != null) prefs[KEY_AUTH_USER] = user
            else prefs.remove(KEY_AUTH_USER)
        }
    }

    suspend fun setAuth(user: String, hash: String) {
        store.edit { prefs ->
            prefs[KEY_AUTH_USER] = user
            prefs[KEY_AUTH_HASH] = hash
        }
    }

    suspend fun clearAuth() {
        store.edit { prefs ->
            prefs.remove(KEY_AUTH_USER)
            prefs.remove(KEY_AUTH_HASH)
            prefs.remove(KEY_VAULT_REMEMBER)
        }
    }
}
