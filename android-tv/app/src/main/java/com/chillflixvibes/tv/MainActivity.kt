package com.chillflixvibes.tv

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.chillflixvibes.tv.player.GeckoEngine
import com.chillflixvibes.tv.ui.ChillFlixApp
import com.chillflixvibes.tv.ui.theme.ChillFlixTheme

/**
 * Hosts the native browse UI.
 *
 * The browse experience is entirely native Compose — TMDB data rendered as
 * focusable rows and grids — so the D-pad moves a focus ring instead of
 * dragging a mouse cursor around a web page. Only playback itself runs in a
 * WebView, because the stream providers are embed pages (see PlayerActivity).
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // Draw behind the system bars. A TV has none, but this also means the
        // hero gets the full 16:9 panel — anything less would crop the artwork.
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        // Start the engine while the user is still browsing. Gecko takes a few
        // seconds to come up on slow hardware, and paying that here means it is
        // already warm when they press Play.
        runCatching { GeckoEngine.runtime(this) }
            .onFailure { Log.w("ChillFlix", "Gecko warm-up failed", it) }

        setContent {
            ChillFlixTheme {
                ChillFlixApp()
            }
        }
    }
}
