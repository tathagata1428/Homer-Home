package ro.b4it.homer.ui.screens.ambient

import android.content.Context
import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import ro.b4it.homer.service.AmbientService
import javax.inject.Inject

/** Mirrors the website's ambient sound definitions exactly (same YouTube IDs). */
enum class AmbientSound(val key: String, val emoji: String, val label: String, val ytId: String) {
    OCEAN    ("ocean",     "🌊", "Ocean",     "WHPEKLQID4U"),
    FIRE     ("fire",      "🔥", "Fireplace", "UgHKb_7884o"),
    RAIN     ("rain",      "🌧️", "Rain",      "mPZkdNFkNps"),
    JAZZ     ("rainywindow","🎷","Jazz",      "Dx5qFachd3A"),
    CAFE     ("cafe",      "☕", "Cafe",      "uiMXGIG_DQo"),
    LOFI     ("lofi",      "🎵", "Lo-Fi",     "Na0w3Mz46GA"),
    WIND     ("wind",      "💨", "Wind",      "sGkh1W5cbH4"),
    SYNTHWAVE("synthwave", "🌆", "Synthwave", "4xDzrJKXOOY"),
}

/** Mirrors the website's preset mixes (key → volume 0-100). */
enum class AmbientPreset(val label: String, val config: Map<AmbientSound, Int>) {
    SLEEP  ("Sleep Mix",    mapOf(AmbientSound.FIRE to 40, AmbientSound.RAIN to 60)),
    RAINY  ("Rainy Mix",    mapOf(AmbientSound.RAIN to 70, AmbientSound.OCEAN to 40)),
    READING("Reading Mix",  mapOf(AmbientSound.LOFI to 50, AmbientSound.FIRE to 10,
                                  AmbientSound.WIND to 10, AmbientSound.RAIN to 10)),
    COZY   ("Cozy Night",   mapOf(AmbientSound.FIRE to 40, AmbientSound.RAIN to 40,
                                  AmbientSound.JAZZ to 30)),
}

data class SoundState(
    val playing: Boolean = false,
    val volume: Int = 70,       // 0-100
    val ready: Boolean = false, // YouTube player is initialized
)

@HiltViewModel
class AmbientSoundsViewModel @Inject constructor(
    @ApplicationContext private val ctx: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(
        AmbientSound.values().associateWith { SoundState() }
    )
    val state: StateFlow<Map<AmbientSound, SoundState>> = _state.asStateFlow()

    /** JS commands emitted to the WebView (evaluated on the main thread by the screen). */
    private val _jsCommands = MutableSharedFlow<String>(extraBufferCapacity = 128)
    val jsCommands: SharedFlow<String> = _jsCommands.asSharedFlow()

    val anyPlaying: Boolean get() = _state.value.any { it.value.playing }

    // ---- Called by WebView JavaScript bridge ----

    fun onPlayerReady(key: String) {
        // JS onReady handler already handles playback via autoplay:1 + isPlaying check.
        // We just sync the ready flag here.
        val sound = AmbientSound.values().find { it.key == key } ?: return
        updateSound(sound) { it.copy(ready = true) }
    }

    // ---- UI actions ----

    fun toggle(sound: AmbientSound) {
        val cur = _state.value[sound] ?: SoundState()
        if (cur.playing) {
            updateSound(sound) { it.copy(playing = false) }
            emit("pauseSound('${sound.key}')")
            if (!anyPlaying) stopAmbientService()
        } else {
            val vol = cur.volume
            updateSound(sound) { it.copy(playing = true) }
            startAmbientService()
            if (cur.ready) emit("setVolAndPlay('${sound.key}', $vol)")
            else emit("initAndPlay('${sound.key}', $vol)")
        }
    }

    fun setVolume(sound: AmbientSound, vol: Int) {
        updateSound(sound) { it.copy(volume = vol) }
        if (_state.value[sound]?.playing == true) emit("setVolume('${sound.key}', $vol)")
    }

    fun applyPreset(preset: AmbientPreset) {
        _state.value.keys.forEach { sound -> updateSound(sound) { it.copy(playing = false) } }
        emit("stopAll()")
        preset.config.forEach { (sound, vol) ->
            updateSound(sound) { it.copy(volume = vol, playing = true) }
            if (_state.value[sound]?.ready == true) emit("setVolAndPlay('${sound.key}', $vol)")
            else emit("initAndPlay('${sound.key}', $vol)")
        }
        startAmbientService()
    }

    fun stopAll() {
        _state.value.keys.forEach { sound ->
            updateSound(sound) { it.copy(playing = false) }
        }
        emit("stopAll()")
        stopAmbientService()
    }

    private fun startAmbientService() {
        try { ctx.startForegroundService(Intent(ctx, AmbientService::class.java)) } catch (_: Exception) {}
    }

    private fun stopAmbientService() {
        try { ctx.stopService(Intent(ctx, AmbientService::class.java)) } catch (_: Exception) {}
    }

    // ---- Helpers ----

    private fun updateSound(sound: AmbientSound, transform: (SoundState) -> SoundState) {
        _state.value = _state.value.toMutableMap().apply {
            this[sound] = transform(this[sound] ?: SoundState())
        }
    }

    private fun emit(js: String) {
        viewModelScope.launch { _jsCommands.emit(js) }
    }
}
