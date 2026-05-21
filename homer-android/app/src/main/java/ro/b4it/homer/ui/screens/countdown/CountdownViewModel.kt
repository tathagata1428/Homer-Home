package ro.b4it.homer.ui.screens.countdown

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ro.b4it.homer.data.remote.Quote
import ro.b4it.homer.data.remote.QuotesApi
import javax.inject.Inject

data class CountdownTick(
    val hasEvent: Boolean = false,
    val isPast:   Boolean = false,
    val days:     Long    = 0,
    val hours:    Long    = 0,
    val mins:     Long    = 0,
    val secs:     Long    = 0,
)

@HiltViewModel
class CountdownViewModel @Inject constructor(
    @ApplicationContext private val ctx: Context,
    private val quotesApi: QuotesApi,
) : ViewModel() {

    private val _eventName    = MutableStateFlow("")
    val eventName: StateFlow<String> = _eventName.asStateFlow()

    private val _eventDateMs  = MutableStateFlow(0L)
    val eventDateMs: StateFlow<Long> = _eventDateMs.asStateFlow()

    private val _tick         = MutableStateFlow(CountdownTick())
    val tick: StateFlow<CountdownTick> = _tick.asStateFlow()

    private val _quote        = MutableStateFlow("")
    val quote: StateFlow<String> = _quote.asStateFlow()

    private val _loading      = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private var allQuotes: List<Quote> = emptyList()
    private var quoteJob: Job? = null

    init {
        loadConfig()
        viewModelScope.launch {
            while (true) {
                updateTick()
                delay(1000L)
            }
        }
        // Pre-load quotes in background
        viewModelScope.launch { allQuotes = quotesApi.fetchAll() }
    }

    fun setEvent(name: String, dateMs: Long) {
        _eventName.value   = name
        _eventDateMs.value = dateMs
        updateTick()
        saveConfig()
        refreshQuote()
    }

    fun clearEvent() {
        _eventName.value   = ""
        _eventDateMs.value = 0L
        _quote.value       = ""
        _tick.value        = CountdownTick()
        saveConfig()
    }

    fun refreshQuote() {
        if (_eventDateMs.value == 0L) return
        quoteJob?.cancel()
        quoteJob = viewModelScope.launch {
            _loading.value = true
            try {
                if (allQuotes.isEmpty()) allQuotes = quotesApi.fetchAll()
                val q = allQuotes.random()
                _quote.value = "\u201c${q.text}\u201d\n\u2014 ${q.author}"
            } catch (_: Exception) {
                _quote.value = "Could not load a quote."
            } finally {
                _loading.value = false
            }
        }
    }

    private fun updateTick() {
        val target = _eventDateMs.value
        if (target == 0L) { _tick.value = CountdownTick(); return }
        val diff = target - System.currentTimeMillis()
        if (diff <= 0) { _tick.value = CountdownTick(hasEvent = true, isPast = true); return }
        _tick.value = CountdownTick(
            hasEvent = true,
            isPast   = false,
            days     = diff / 86400000,
            hours    = (diff % 86400000) / 3600000,
            mins     = (diff % 3600000)  / 60000,
            secs     = (diff % 60000)    / 1000,
        )
    }

    private fun loadConfig() {
        val sp = ctx.getSharedPreferences("homer_countdown", Context.MODE_PRIVATE)
        _eventName.value   = sp.getString("name",  "")  ?: ""
        _eventDateMs.value = sp.getLong("dateMs", 0L)
        updateTick()
    }

    private fun saveConfig() {
        ctx.getSharedPreferences("homer_countdown", Context.MODE_PRIVATE).edit()
            .putString("name",   _eventName.value)
            .putLong("dateMs",   _eventDateMs.value)
            .apply()
    }
}
