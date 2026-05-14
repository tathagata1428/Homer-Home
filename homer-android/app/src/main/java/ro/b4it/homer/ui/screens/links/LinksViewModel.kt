package ro.b4it.homer.ui.screens.links

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.LinkDao
import ro.b4it.homer.data.local.entity.Link
import ro.b4it.homer.data.sync.SyncEngine
import javax.inject.Inject

@HiltViewModel
class LinksViewModel @Inject constructor(
    private val dao: LinkDao,
    private val sync: SyncEngine,
) : ViewModel() {
    val links = dao.getAll()

    fun addLink(link: Link) {
        viewModelScope.launch {
            dao.upsert(link)
            sync.pushLinksDebounced()
        }
    }

    fun deleteLink(link: Link) {
        viewModelScope.launch {
            dao.delete(link)
            sync.pushLinksDebounced()
        }
    }
}
