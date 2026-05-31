package ro.b4it.homer.ui.screens.account

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import ro.b4it.homer.data.sync.SyncClient
import javax.inject.Inject

data class AccountState(
    val isSyncConfigured: Boolean = false,
)

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val syncClient: SyncClient,
) : ViewModel() {

    private val _state = MutableStateFlow(AccountState(
        isSyncConfigured = syncClient.isConfigured(),
    ))
    val state: StateFlow<AccountState> = _state.asStateFlow()
}
