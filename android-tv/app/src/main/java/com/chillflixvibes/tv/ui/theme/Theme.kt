package com.chillflixvibes.tv.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** The web app's Tailwind palette (see `tailwind.config.ts`), as Compose colors. */
val Background = Color(0xFF0A0E17)
val Surface = Color(0xFF101827)
val SurfaceLight = Color(0xFF1B2536)
val Primary = Color(0xFF3F83F8)
val PrimaryDark = Color(0xFF2563EB)
val Muted = Color(0xFF9BA1A6)
val Accent = Color(0xFFACC2EC)
val Star = Color(0xFFFBBF24)

private val ChillFlixColors = darkColorScheme(
    primary = Primary,
    onPrimary = Color.White,
    primaryContainer = PrimaryDark,
    onPrimaryContainer = Color.White,
    secondary = Accent,
    background = Background,
    onBackground = Color.White,
    surface = Surface,
    onSurface = Color.White,
    surfaceVariant = SurfaceLight,
    onSurfaceVariant = Muted,
)

/**
 * Type scale tuned for the couch. Everything is a few steps larger than the
 * phone defaults — the web build does the same thing by bumping the root
 * font-size to 20px in TV mode.
 */
private val TvTypography = Typography(
    displaySmall = TextStyle(fontSize = 40.sp, lineHeight = 46.sp, fontWeight = FontWeight.Bold),
    headlineMedium = TextStyle(fontSize = 30.sp, lineHeight = 36.sp, fontWeight = FontWeight.Bold),
    headlineSmall = TextStyle(fontSize = 24.sp, lineHeight = 30.sp, fontWeight = FontWeight.Bold),
    titleLarge = TextStyle(fontSize = 21.sp, lineHeight = 27.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 18.sp, lineHeight = 24.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 17.sp, lineHeight = 25.sp),
    bodyMedium = TextStyle(fontSize = 15.sp, lineHeight = 22.sp),
    labelLarge = TextStyle(fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),
    labelMedium = TextStyle(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.Medium),
)

@Composable
fun ChillFlixTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ChillFlixColors,
        typography = TvTypography,
        content = content,
    )
}
