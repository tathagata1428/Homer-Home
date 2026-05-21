package ro.b4it.homer.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val HomerColorScheme = lightColorScheme(
    primary              = AccentBlue,
    onPrimary            = Color.White,
    primaryContainer     = BgCardAlt,
    onPrimaryContainer   = TextPrimary,
    secondary            = AccentViolet,
    onSecondary          = Color.White,
    secondaryContainer   = BgCard,
    onSecondaryContainer = TextPrimary,
    tertiary             = AccentCyan,
    onTertiary           = Color.White,
    background           = BgPrimary,
    onBackground         = TextPrimary,
    surface              = BgCard,
    onSurface            = TextPrimary,
    surfaceVariant       = BgCardAlt,
    onSurfaceVariant     = TextMuted,
    outline              = BorderDefault,
    outlineVariant       = BorderSubtle,
    error                = AccentRed,
    onError              = Color.White,
)

@Composable
fun HomerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = HomerColorScheme,
        typography  = HomerTypography,
        content     = content,
    )
}
