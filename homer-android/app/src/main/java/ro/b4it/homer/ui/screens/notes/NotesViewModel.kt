package ro.b4it.homer.ui.screens.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.NoteDao
import ro.b4it.homer.data.local.entity.Note
import ro.b4it.homer.data.sync.SyncEngine
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class NotesViewModel @Inject constructor(
    private val dao: NoteDao,
    private val sync: SyncEngine,
) : ViewModel() {

    private val _search = MutableStateFlow("")
    val search: StateFlow<String> = _search.asStateFlow()

    val pages: Flow<List<Note>> = _search
        .debounce(300)
        .flatMapLatest { q -> if (q.isBlank()) dao.getRootPages() else dao.search(q) }

    // Currently opened note for editing
    private val _editing = MutableStateFlow<Note?>(null)
    val editing: StateFlow<Note?> = _editing.asStateFlow()

    private val _editContent = MutableStateFlow("")
    val editContent: StateFlow<String> = _editContent.asStateFlow()

    fun setSearch(q: String) { _search.value = q }

    fun newPage() {
        val note = Note(id = UUID.randomUUID().toString(), title = "Untitled", emoji = "📝")
        viewModelScope.launch {
            dao.upsert(note)
            openNote(note)
        }
    }

    fun openNote(note: Note) {
        _editing.value = note
        _editContent.value = note.content
        observeContentSave()
    }

    fun closeNote() { _editing.value = null; contentSaveJob?.cancel() }

    fun setEditContent(text: String) { _editContent.value = text }

    fun setTitle(title: String) {
        val cur = _editing.value ?: return
        val updated = cur.copy(title = title, updatedAt = System.currentTimeMillis())
        _editing.value = updated
        viewModelScope.launch { dao.upsert(updated) }
    }

    fun setEmoji(emoji: String) {
        val cur = _editing.value ?: return
        val updated = cur.copy(emoji = emoji, updatedAt = System.currentTimeMillis())
        _editing.value = updated
        viewModelScope.launch { dao.upsert(updated) }
    }

    fun deleteNote(note: Note) {
        if (_editing.value?.id == note.id) closeNote()
        viewModelScope.launch { dao.delete(note); pushSync() }
    }

    fun pinNote(note: Note) {
        viewModelScope.launch { dao.upsert(note.copy(pinned = !note.pinned)) }
    }

    @OptIn(FlowPreview::class)
    private var contentSaveJob: kotlinx.coroutines.Job? = null
    private fun observeContentSave() {
        contentSaveJob?.cancel()
        contentSaveJob = viewModelScope.launch {
            _editContent.debounce(600).collect { text ->
                val cur = _editing.value ?: return@collect
                val updated = cur.copy(content = text, updatedAt = System.currentTimeMillis())
                _editing.value = updated
                dao.upsert(updated)
                pushSync()
            }
        }
    }

    private fun pushSync() {
        sync.schedulePush("homer-notes") {
            // push all notes to field_state
        }
    }
}
