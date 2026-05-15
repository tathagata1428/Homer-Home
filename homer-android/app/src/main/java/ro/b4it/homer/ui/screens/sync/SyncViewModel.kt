package ro.b4it.homer.ui.screens.sync

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ro.b4it.homer.data.supabase.SupabaseManager
import ro.b4it.homer.data.sync.SyncEngine
import javax.inject.Inject

data class SyncState(
    val isBogdan: Boolean = false,
    val syncing: Boolean = false,
    val lastSyncMsg: String = "Not synced yet",
    val error: String? = null,
)

@HiltViewModel
class SyncViewModel @Inject constructor(
    private val supabase: SupabaseManager,
    private val sync: SyncEngine,
) : ViewModel() {

    private val _state = MutableStateFlow(SyncState(isBogdan = supabase.isBogdan()))
    val state: StateFlow<SyncState> = _state.asStateFlow()

    fun syncNow() {
        if (!supabase.isBogdan()) {
            _state.value = _state.value.copy(error = "Sync is only available for Bogdan's account.")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(syncing = true, error = null)
            try {
                sync.pushAll()  // push local → cloud first (captures any pending deletions)
                sync.pullAll()  // then pull cloud → local
                _state.value = _state.value.copy(
                    syncing = false,
                    lastSyncMsg = "Synced at ${java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())}",
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(syncing = false, error = e.message)
            }
        }
    }
}
