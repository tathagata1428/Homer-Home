package ro.b4it.homer.ui.screens.secrets

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.VaultDao
import ro.b4it.homer.data.local.entity.VaultCredential
import ro.b4it.homer.data.local.entity.VaultLink
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class SecretsViewModel @Inject constructor(private val dao: VaultDao) : ViewModel() {
    val credentials = dao.getCredentials()
    val links = dao.getLinks()

    fun addCredential(label: String, site: String, user: String, pw: String, details: String) {
        viewModelScope.launch {
            dao.upsertCredential(
                VaultCredential(
                    id = UUID.randomUUID().toString(),
                    label = label, site = site, username = user,
                    passwordEncrypted = pw, details = details,
                )
            )
        }
    }

    fun deleteCredential(cred: VaultCredential) {
        viewModelScope.launch { dao.deleteCredential(cred) }
    }

    fun addLink(name: String, url: String, desc: String) {
        viewModelScope.launch {
            dao.upsertLink(
                VaultLink(id = UUID.randomUUID().toString(), name = name, url = url, description = desc)
            )
        }
    }

    fun deleteLink(link: VaultLink) {
        viewModelScope.launch { dao.deleteLink(link) }
    }
}
