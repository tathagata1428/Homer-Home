package ro.b4it.homer.ui.screens.secrets

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.VaultDao
import ro.b4it.homer.data.local.entity.VaultNote
import javax.inject.Inject

@HiltViewModel
class SecretNotesViewModel @Inject constructor(private val dao: VaultDao) : ViewModel() {

    private val _personalText = MutableStateFlow("")
    val personalText: StateFlow<String> = _personalText.asStateFlow()

    private val _workText = MutableStateFlow("")
    val workText: StateFlow<String> = _workText.asStateFlow()

    init {
        viewModelScope.launch {
            _personalText.value = dao.getNote("personal")?.textEncrypted ?: ""
            _workText.value = dao.getNote("work")?.textEncrypted ?: ""
        }
    }

    fun setPersonalText(text: String) {
        _personalText.value = text
        viewModelScope.launch {
            dao.upsertNote(VaultNote(id = 1, mode = "personal", textEncrypted = text))
        }
    }

    fun setWorkText(text: String) {
        _workText.value = text
        viewModelScope.launch {
            dao.upsertNote(VaultNote(id = 2, mode = "work", textEncrypted = text))
        }
    }
}
