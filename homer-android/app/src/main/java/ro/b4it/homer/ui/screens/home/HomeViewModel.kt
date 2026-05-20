package ro.b4it.homer.ui.screens.home

import android.annotation.SuppressLint
import android.content.Context
import android.content.Context.MODE_PRIVATE
import android.location.Location
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.KanbanDao
import ro.b4it.homer.data.local.dao.PomodoroDao
import ro.b4it.homer.data.local.dao.QuoteDao
import ro.b4it.homer.data.local.entity.KanbanTask
import ro.b4it.homer.data.local.entity.SavedQuote
import ro.b4it.homer.data.remote.Quote
import ro.b4it.homer.data.remote.QuotesApi
import ro.b4it.homer.data.remote.WeatherApi
import ro.b4it.homer.data.remote.WeatherResponse
import ro.b4it.homer.data.remote.weatherCodeToDesc
import ro.b4it.homer.data.remote.weatherCodeToIcon
import ro.b4it.homer.data.sync.SyncEngine
import java.time.LocalDateTime
import javax.inject.Inject
import kotlin.random.Random

@HiltViewModel
class HomeViewModel @Inject constructor(
    @ApplicationContext private val ctx: Context,
    private val weatherApi: WeatherApi,
    private val quotesApi: QuotesApi,
    private val pomodoroDao: PomodoroDao,
    private val kanbanDao: KanbanDao,
    private val quoteDao: QuoteDao,
    private val sync: SyncEngine,
) : ViewModel() {

    // ---- Clock ----
    private val _now = MutableStateFlow(LocalDateTime.now())
    val now: StateFlow<LocalDateTime> = _now.asStateFlow()

    // ---- Weather ----
    data class WeatherUi(
        val icon: String = "☀️",
        val temp: String = "--°",
        val desc: String = "",
        val place: String = "",
        val loading: Boolean = true,
        val forecast: List<DayForecast> = emptyList(),
    )
    data class DayForecast(val day: String, val icon: String, val hi: String, val lo: String)

    private val _weather = MutableStateFlow(WeatherUi())
    val weather: StateFlow<WeatherUi> = _weather.asStateFlow()

    // ---- Quotes ----
    data class QuoteUi(
        val text: String = "",
        val author: String = "",
        val humorMode: Boolean = false,
        val loading: Boolean = true,
        val nextRefreshSecs: Int = 900,
    )
    private val _quote = MutableStateFlow(QuoteUi())
    val quote: StateFlow<QuoteUi> = _quote.asStateFlow()
    val savedQuotes = quoteDao.getAll()

    // ---- Focus Tasks ----
    val openTasks = pomodoroDao.getOpenTasks()

    val inProgressKanban = kanbanDao.getInProgressTasksFlow()

    // ---- Countdown ----
    data class CountdownUi(
        val hasEvent: Boolean = false,
        val isPast:   Boolean = false,
        val name:     String  = "",
        val days:     Long    = 0,
        val hours:    Long    = 0,
        val mins:     Long    = 0,
        val secs:     Long    = 0,
        val dateMs:   Long    = 0L,
    )
    private val _cdEventMs = MutableStateFlow(0L)
    private val _cdName    = MutableStateFlow("")

    val countdown: StateFlow<CountdownUi> = combine(_now, _cdEventMs, _cdName) { _, targetMs, name ->
        if (targetMs == 0L) return@combine CountdownUi()
        val diff = targetMs - System.currentTimeMillis()
        if (diff <= 0) return@combine CountdownUi(hasEvent = true, isPast = true, name = name, dateMs = targetMs)
        CountdownUi(
            hasEvent = true,
            name  = name,
            dateMs = targetMs,
            days  = diff / 86400000,
            hours = (diff % 86400000) / 3600000,
            mins  = (diff % 3600000)  / 60000,
            secs  = (diff % 60000)    / 1000,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), CountdownUi())

    // Internal
    private var allQuotes: List<Quote> = emptyList()
    private var seenIndices = mutableSetOf<Int>()
    private var countdownSecs = 900

    init {
        startClock()
        loadWeather()
        loadQuotes()
        startQuoteRefreshCycle()
        loadCountdown()
    }

    fun reloadCountdown() = loadCountdown()

    private fun loadCountdown() {
        val sp = ctx.getSharedPreferences("homer_countdown", MODE_PRIVATE)
        _cdEventMs.value = sp.getLong("dateMs", 0L)
        _cdName.value    = sp.getString("name", "") ?: ""
    }

    private fun startClock() {
        viewModelScope.launch {
            while (true) {
                _now.value = LocalDateTime.now()
                delay(1_000)
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun loadWeather() {
        viewModelScope.launch {
            try {
                val fusedClient = LocationServices.getFusedLocationProviderClient(ctx)
                fusedClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
                    .addOnSuccessListener { loc: Location? ->
                        if (loc != null) {
                            viewModelScope.launch {
                                val resp = weatherApi.getForecast(loc.latitude, loc.longitude)
                                val place = weatherApi.getPlaceName(loc.latitude, loc.longitude)
                                if (resp != null) updateWeatherUi(resp, place)
                            }
                        } else {
                            _weather.value = _weather.value.copy(loading = false, place = "Location unavailable")
                        }
                    }
                    .addOnFailureListener {
                        _weather.value = _weather.value.copy(loading = false)
                    }
            } catch (e: Exception) {
                _weather.value = _weather.value.copy(loading = false)
            }
        }
    }

    private fun updateWeatherUi(resp: WeatherResponse, place: String) {
        val cur = resp.current
        val isDay = cur.is_day == 1
        val forecast = resp.daily?.let { daily ->
            daily.time.take(7).mapIndexedNotNull { i, date ->
                if (i == 0) null // skip today
                else DayForecast(
                    day  = date.takeLast(5),
                    icon = weatherCodeToIcon(daily.weathercode.getOrElse(i) { 0 }, true),
                    hi   = "${daily.temperature_2m_max.getOrNull(i)?.toInt() ?: "--"}°",
                    lo   = "${daily.temperature_2m_min.getOrNull(i)?.toInt() ?: "--"}°",
                )
            }
        } ?: emptyList()

        _weather.value = WeatherUi(
            icon     = weatherCodeToIcon(cur.weathercode, isDay),
            temp     = "${cur.temperature_2m.toInt()}°C",
            desc     = weatherCodeToDesc(cur.weathercode),
            place    = place,
            loading  = false,
            forecast = forecast,
        )
    }

    private fun loadQuotes() {
        viewModelScope.launch {
            allQuotes = quotesApi.fetchAll()
            pickNextQuote()
        }
    }

    private fun pickNextQuote() {
        val pool = if (_quote.value.humorMode) quotesApi.humorFallback() else allQuotes
        if (pool.isEmpty()) return
        if (seenIndices.size >= pool.size) seenIndices.clear()
        var idx: Int
        do { idx = Random.nextInt(pool.size) } while (idx in seenIndices && seenIndices.size < pool.size)
        seenIndices.add(idx)
        val q = pool[idx]
        _quote.value = _quote.value.copy(text = q.text, author = q.author, loading = false)
        countdownSecs = 900
    }

    private fun startQuoteRefreshCycle() {
        viewModelScope.launch {
            while (true) {
                delay(1_000)
                countdownSecs = maxOf(0, countdownSecs - 1)
                _quote.value = _quote.value.copy(nextRefreshSecs = countdownSecs)
                if (countdownSecs == 0) pickNextQuote()
            }
        }
    }

    fun nextQuote() = pickNextQuote()

    fun toggleHumorMode() {
        _quote.value = _quote.value.copy(humorMode = !_quote.value.humorMode)
        pickNextQuote()
    }

    fun saveCurrentQuote() {
        val q = _quote.value
        if (q.text.isBlank()) return
        viewModelScope.launch {
            quoteDao.insert(SavedQuote(text = q.text, author = q.author))
        }
    }

    fun deleteSavedQuote(quote: SavedQuote) {
        viewModelScope.launch { quoteDao.delete(quote) }
    }

    fun deleteFocusTask(task: ro.b4it.homer.data.local.entity.PomodoroTask) {
        viewModelScope.launch { pomodoroDao.deleteTask(task); sync.pushPomodoroTasksNow() }
    }

    fun clearAllFocusTasks() {
        viewModelScope.launch { pomodoroDao.clearAllTasks(); sync.pushPomodoroTasksNow() }
    }

    fun moveKanbanTaskToDone(task: KanbanTask) {
        viewModelScope.launch { kanbanDao.moveTask(task.id, "done") }
    }

    fun refreshWeather() = loadWeather()
}
