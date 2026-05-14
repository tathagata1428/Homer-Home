package ro.b4it.homer.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val HomerColorScheme = darkColorScheme(
    primary            = AccentBlue,
    onPrimary          = TextPrimary,
    primaryContainer   = BgCard,
    onPrimaryContainer = TextPrimary,
    secondary          = AccentViolet,
    onSecondary        = TextPrimary,
    secondaryContainer = BgCardAlt,
    onSecondaryContainer = TextPrimary,
    tertiary           = AccentCyan,
    onTertiary         = TextPrimary,
    background         = BgPrimary,
    onBackground       = TextPrimary,
    surface            = BgCard,
    onSurface          = TextPrimary,
    surfaceVariant     = BgCardAlt,
    onSurfaceVariant   = TextMuted,
    outline            = BorderDefault,
    outlineVariant     = BorderSubtle,
    error              = AccentRed,
    onError            = TextPrimary,
)

@Composable
fun HomerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = HomerColorScheme,
        typography  = HomerTypography,
        content     = content,
    )
}
