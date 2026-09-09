package com.chillflixvibes.tv.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * The web app's Tailwind palette (see `tailwind.config.ts`), as Compose colors.
 *
 * A neutral near-black ground rather than a navy one: artwork is the only
 * colour on a streaming screen, and a tinted ground competes with every poster
 * on it.
 */
val Background = Color(0xFF0A0A0A)
val Surface = Color(0xFF141414)
val SurfaceLight = Color(0xFF1F1F1F)
val Primary = Color(0xFF3F83F8)
val PrimaryDark = Color(0xFF2563EB)
val Muted = Color(0xFFA1A1AA)
val Accent = Color(0xFFD4D4D8)

/** A rating is the one thing on the page allowed a colour of its own. */
val StarAmber = Color(0xFFFBBF24)

/**
 * The glass surfaces, for anything that floats over artwork: a translucent
 * black fill under a hairline white edge. The web pairs the same fill with a
 * backdrop blur, which Compose has no portable equivalent for, so the fill here
 * carries the legibility on its own and is correspondingly darker.
 */
val Glass = Color.Black.copy(alpha = 0.62f)
val GlassRaised = Color.White.copy(alpha = 0.10f)
val GlassFocused = Color.White.copy(alpha = 0.20f)
val Hairline = Color.White.copy(alpha = 0.10f)

/** 12-16dp everywhere: the web's rounded-xl / rounded-2xl. */
val CardShape = RoundedCornerShape(14.dp)
val ControlShape = RoundedCornerShape(14.dp)
val PanelShape = RoundedCornerShape(18.dp)
val PillShape = RoundedCornerShape(percent = 50)

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
 * font-size to 20px in TV mode. Display sizes carry the web's tight tracking,
 * which is what stops a 54sp title from reading as a banner.
 */
private val TvTypography = Typography(
    displayLarge = TextStyle(
        fontSize = 54.sp,
        lineHeight = 58.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = (-1.4).sp,
    ),
    displaySmall = TextStyle(
        fontSize = 40.sp,
        lineHeight = 46.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = (-0.8).sp,
    ),
    headlineMedium = TextStyle(fontSize = 32.sp, lineHeight = 38.sp, fontWeight = FontWeight.Bold),
    headlineSmall = TextStyle(fontSize = 26.sp, lineHeight = 32.sp, fontWeight = FontWeight.Bold),
    titleLarge = TextStyle(
        fontSize = 26.sp,
        lineHeight = 32.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = (-0.3).sp,
    ),
    titleMedium = TextStyle(fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 18.sp, lineHeight = 26.sp),
    bodyMedium = TextStyle(fontSize = 16.sp, lineHeight = 24.sp),
    labelLarge = TextStyle(fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold),
    labelMedium = TextStyle(fontSize = 14.sp, lineHeight = 19.sp, fontWeight = FontWeight.Medium),
    labelSmall = TextStyle(fontSize = 13.sp, lineHeight = 17.sp, fontWeight = FontWeight.Medium),
)

@Composable
fun ChillFlixTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ChillFlixColors,
        typography = TvTypography,
        content = content,
    )
}
