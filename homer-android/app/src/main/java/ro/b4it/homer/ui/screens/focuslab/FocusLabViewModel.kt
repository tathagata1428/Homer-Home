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
        viewModelScope.launch {
            _brainDump.value = settingDao.get(KEY_BRAIN_DUMP) ?: ""
            _zenGoal.value   = settingDao.get(KEY_ZEN_GOAL) ?: ""
        }
        observeBrainDumpSave()
    }

    @OptIn(FlowPreview::class)
    private fun observeBrainDumpSave() {
        viewModelScope.launch {
            _brainDump.debounce(800).collect { text ->
                settingDao.set(AppSetting(KEY_BRAIN_DUMP, text))
                sync.schedulePush("homer-brain-dump") {
                    // push via field_state
                }
            }
        }
    }

    fun setBrainDump(text: String) { _brainDump.value = text }

    fun setZenGoal(text: String) {
        _zenGoal.value = text
        viewModelScope.launch { settingDao.set(AppSetting(KEY_ZEN_GOAL, text)) }
    }

    companion object {
        const val KEY_BRAIN_DUMP = "homer-brain-dump"
        const val KEY_ZEN_GOAL   = "homer-zen-goal"
    }
}
