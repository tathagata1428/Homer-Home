package ro.b4it.homer.ui.screens.inbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.InboxDao
import ro.b4it.homer.data.local.entity.InboxItem
import ro.b4it.homer.data.sync.SyncEngine
import javax.inject.Inject

@HiltViewModel
class InboxViewModel @Inject constructor(
    private val dao: InboxDao,
    private val sync: SyncEngine,
) : ViewModel() {
    val items = dao.getAll()
    val count = dao.getCount()

    fun capture(item: InboxItem) {
        viewModelScope.launch {
            dao.insert(item)
            sync.pushInboxDebounced()
        }
    }

    fun delete(item: InboxItem) {
        viewModelScope.launch {
            dao.delete(item)
            sync.pushInboxDebounced()
        }
    }
}
