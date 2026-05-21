package ro.b4it.homer.ui.screens.focuslab

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.AppSettingDao
import ro.b4it.homer.data.local.entity.AppSetting
import ro.b4it.homer.data.sync.SyncEngine
import javax.inject.Inject

@HiltViewModel
class FocusLabViewModel @Inject constructor(
    private val settingDao: AppSettingDao,
    private val sync: SyncEngine,
) : ViewModel() {

    private val _brainDump = MutableStateFlow("")
    val brainDump: StateFlow<String> = _brainDump.asStateFlow()

    private val _zenGoal = MutableStateFlow("")
    val zenGoal: StateFlow<String> = _zenGoal.asStateFlow()

    init {
        // Collect from DB flows so pulled Supabase values appear immediately
        viewModelScope.launch {
            settingDao.getFlow(KEY_BRAIN_DUMP).collect { v -> _brainDump.value = v ?: "" }
        }
        viewModelScope.launch {
            settingDao.getFlow(KEY_ZEN_GOAL).collect { v -> _zenGoal.value = v ?: "" }
        }
        observeBrainDumpSave()
    }

    @OptIn(FlowPreview::class)
    private fun observeBrainDumpSave() {
        viewModelScope.launch {
            _brainDump.debounce(800).collect { text ->
                settingDao.set(AppSetting(KEY_BRAIN_DUMP, text))
                sync.pushBrainDumpDebounced()
            }
        }
    }

    fun setBrainDump(text: String) { _brainDump.value = text }

    fun setZenGoal(text: String) {
        _zenGoal.value = text
        viewModelScope.launch {
            settingDao.set(AppSetting(KEY_ZEN_GOAL, text))
            sync.pushZenGoalDebounced()
        }
    }

    companion object {
        const val KEY_BRAIN_DUMP = "homer-brain-dump"
        const val KEY_ZEN_GOAL   = "homer-zen-goal"
    }
}
