package ro.b4it.homer.data.remote

import android.util.Log
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WeatherApi @Inject constructor(private val http: OkHttpClient) {

    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    suspend fun getForecast(lat: Double, lon: Double): WeatherResponse? = try {
        val url = "https://api.open-meteo.com/v1/forecast" +
            "?latitude=$lat&longitude=$lon" +
            "&current=temperature_2m,weathercode,windspeed_10m,is_day" +
            "&daily=temperature_2m_max,temperature_2m_min,weathercode" +
            "&timezone=auto"
        val body = http.newCall(Request.Builder().url(url).build()).execute().body?.string()
        body?.let { json.decodeFromString<WeatherResponse>(it) }
    } catch (e: Exception) { Log.e("WeatherApi", "forecast error", e); null }

    suspend fun getPlaceName(lat: Double, lon: Double): String = try {
        val url = "https://nominatim.openstreetmap.org/reverse?lat=$lat&lon=$lon&format=json"
        val body = http.newCall(
            Request.Builder().url(url)
                .header("User-Agent", "HomerApp/1.0")
                .build()
        ).execute().body?.string()
        val place = body?.let { json.decodeFromString<NominatimResponse>(it) }
        place?.address?.city
            ?: place?.address?.town
            ?: place?.address?.village
            ?: place?.address?.county
            ?: "Unknown"
    } catch (e: Exception) { "Unknown" }
}

@Serializable
data class WeatherResponse(
    val current: CurrentWeather,
    val daily: DailyWeather? = null,
)

@Serializable
data class CurrentWeather(
    val temperature_2m: Double = 0.0,
    val weathercode: Int = 0,
    val windspeed_10m: Double = 0.0,
    val is_day: Int = 1,
)

@Serializable
data class DailyWeather(
    val time: List<String> = emptyList(),
    val temperature_2m_max: List<Double?> = emptyList(),
    val temperature_2m_min: List<Double?> = emptyList(),
    val weathercode: List<Int> = emptyList(),
)

@Serializable
data class NominatimResponse(val address: NominatimAddress? = null)

@Serializable
data class NominatimAddress(
    val city: String? = null,
    val town: String? = null,
    val village: String? = null,
    val county: String? = null,
)

fun weatherCodeToIcon(code: Int, isDay: Boolean = true): String = when (code) {
    0             -> if (isDay) "☀️" else "🌙"
    1, 2          -> if (isDay) "⛅" else "🌤️"
    3             -> "☁️"
    45, 48        -> "🌫️"
    51, 53, 55,
    61, 63, 65    -> "🌧️"
    71, 73, 75    -> "❄️"
    80, 81, 82    -> "🌦️"
    95            -> "⛈️"
    96, 99        -> "🌩️"
    else          -> "🌡️"
}

fun weatherCodeToDesc(code: Int): String = when (code) {
    0          -> "Clear sky"
    1          -> "Mainly clear"
    2          -> "Partly cloudy"
    3          -> "Overcast"
    45, 48     -> "Foggy"
    51         -> "Light drizzle"
    53         -> "Moderate drizzle"
    55         -> "Dense drizzle"
    61         -> "Slight rain"
    63         -> "Moderate rain"
    65         -> "Heavy rain"
    71         -> "Slight snow"
    73         -> "Moderate snow"
    75         -> "Heavy snow"
    80         -> "Slight showers"
    81         -> "Moderate showers"
    82         -> "Violent showers"
    95         -> "Thunderstorm"
    96, 99     -> "Thunderstorm w/ hail"
    else       -> "Unknown"
}
