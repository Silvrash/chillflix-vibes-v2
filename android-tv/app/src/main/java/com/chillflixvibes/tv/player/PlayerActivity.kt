package com.chillflixvibes.tv.player

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import org.mozilla.geckoview.AllowOrDeny
import org.mozilla.geckoview.GeckoResult
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoSessionSettings
import org.mozilla.geckoview.GeckoView
import com.chillflixvibes.tv.R
import com.chillflixvibes.tv.data.Episode
import com.chillflixvibes.tv.data.MediaType
import com.chillflixvibes.tv.data.TmdbImage
import com.chillflixvibes.tv.data.TmdbRepository
import com.chillflixvibes.tv.data.WatchEntry
import com.chillflixvibes.tv.data.WatchStore
import com.chillflixvibes.tv.data.playersFor
import com.chillflixvibes.tv.ui.components.FocusableCard
import com.chillflixvibes.tv.ui.components.LoadState
import com.chillflixvibes.tv.ui.components.Loading
import com.chillflixvibes.tv.ui.components.ScreenPadding
import com.chillflixvibes.tv.ui.components.TvButton
import com.chillflixvibes.tv.ui.components.TvChip
import com.chillflixvibes.tv.ui.components.rememberLoad
import com.chillflixvibes.tv.ui.components.requestFocusWhenReady
import com.chillflixvibes.tv.ui.theme.Accent
import com.chillflixvibes.tv.ui.theme.ChillFlixTheme
import com.chillflixvibes.tv.ui.theme.Muted
import kotlinx.coroutines.delay

/**
 * Full-screen playback.
 *
 * The stream providers are embed pages, so the video itself plays in a WebView
 * — there's no native stream URL to hand to ExoPlayer. Everything *around* the
 * video is native, which is what the remote needs: press Back once for a
 * D-pad-navigable panel with the player lineup, the episode strip and an exit
 * button, and press it again to leave.
 */
class PlayerActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Nobody wants the screen dimming twenty minutes into a film.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val type = MediaType.fromSlug(intent.getStringExtra(EXTRA_TYPE))
        val id = intent.getIntExtra(EXTRA_ID, 0)
        val season = intent.getIntExtra(EXTRA_SEASON, 1)
        val episode = intent.getIntExtra(EXTRA_EPISODE, 1)

        setContent {
            ChillFlixTheme {
                PlayerScreen(
                    type = type,
                    id = id,
                    initialSeason = season,
                    initialEpisode = episode,
                    onExit = { finish() },
                )
            }
        }
    }

    companion object {
        internal const val TAG = "ChillFlixPlayer"
        private const val EXTRA_TYPE = "type"
        private const val EXTRA_ID = "id"
        private const val EXTRA_SEASON = "season"
        private const val EXTRA_EPISODE = "episode"

        fun start(context: Context, type: MediaType, id: Int, season: Int = 1, episode: Int = 1) {
            context.startActivity(
                Intent(context, PlayerActivity::class.java)
                    .putExtra(EXTRA_TYPE, type.slug)
                    .putExtra(EXTRA_ID, id)
                    .putExtra(EXTRA_SEASON, season)
                    .putExtra(EXTRA_EPISODE, episode),
            )
        }
    }
}

@Composable
private fun PlayerScreen(
    type: MediaType,
    id: Int,
    initialSeason: Int,
    initialEpisode: Int,
    onExit: () -> Unit,
) {
    val context = LocalContext.current
    val repo = remember { TmdbRepository.get(context) }
    val store = remember { WatchStore(context) }
    val isSeries = type == MediaType.TV

    var season by remember { mutableIntStateOf(initialSeason) }
    var episode by remember { mutableIntStateOf(initialEpisode) }
    var overlayVisible by remember { mutableStateOf(false) }
    var surface by remember { mutableStateOf<View?>(null) }
    var showHint by remember { mutableStateOf(true) }

    // Stepping back past episode 1 lands on the previous season's finale once
    // that season's episode list arrives.
    var pendingLastEpisode by remember { mutableStateOf(false) }

    val detailsState = rememberLoad(type, id) { repo.details(type, id) }
    val details = (detailsState as? LoadState.Success)?.value

    val anilistState = rememberLoad(id, details?.isAnime) {
        if (details?.isAnime == true) repo.anilistId(id) else null
    }
    val anilistId = (anilistState as? LoadState.Success)?.value

    val seasonState = rememberLoad(id, season, isSeries) {
        if (isSeries) runCatching { repo.season(id, season) }.getOrNull() else null
    }
    val episodes = (seasonState as? LoadState.Success)?.value?.episodes.orEmpty()

    LaunchedEffect(episodes) {
        if (pendingLastEpisode && episodes.isNotEmpty()) {
            episode = episodes.last().episodeNumber
            pendingLastEpisode = false
        }
    }

    LaunchedEffect(Unit) {
        delay(5_000)
        showHint = false
    }

    // Remember where we got to, and keep the title at the front of the
    // "Continue watching" shelf.
    LaunchedEffect(details, season, episode) {
        val current = details ?: return@LaunchedEffect
        store.setLastWatched(type, id, season, episode)
        store.record(
            WatchEntry(
                id = id,
                type = type.slug,
                title = current.displayTitle,
                posterPath = current.posterPath,
                backdropPath = current.backdropPath,
                season = season,
                episode = episode,
            ),
        )
    }

    // Anime resolves to a different provider, so hold playback until the
    // AniList lookup settles rather than briefly loading the wrong player.
    val waitingForAnime = details?.isAnime == true && anilistState is LoadState.Loading
    val players = remember(details, anilistId) {
        playersFor(type, details?.isAnime == true, anilistId)
    }
    var preferredPlayer by remember { mutableStateOf(store.preferredPlayer) }
    // A provider that isn't in this lineup (anime has its own), and no stored
    // preference at all, both fall back to the lineup's first player.
    val activeIndex = players.indexOfFirst { it.id == preferredPlayer }.coerceAtLeast(0)

    // The app doesn't build provider URLs any more: it points the WebView at
    // the site's chrome-less `/embed` route, which hosts the same iframe the
    // web app uses. That page is served from the real origin over https, so
    // the provider sees the referrer, headers and page context it expects —
    // conditions a WebView-local page can't reproduce. The lineup below is
    // only used for the controls-panel labels; the choice travels as its
    // provider id, with the position alongside for older site deploys.
    val siteUrl = remember { context.getString(R.string.api_base_url).trimEnd('/') }
    var useProxy by remember { mutableStateOf(store.useProxy) }
    val player = players[activeIndex]
    val url = remember(siteUrl, type, id, season, episode, activeIndex, anilistId, isSeries, useProxy, player) {
        if (useProxy) {
            buildString {
                // Selected by stable id; `server` stays for older site deploys.
                append("$siteUrl/embed/${type.slug}/$id?player=${player.id}&server=$activeIndex")
                if (isSeries) append("&season=$season&episode=$episode")
                if (anilistId != null) append("&anilist=$anilistId")
            }
        } else {
            // Straight to the provider: nothing of ours has to run first.
            if (isSeries) player.episodeUrl(id, season, episode) else player.movieUrl(id)
        }
    }
    LaunchedEffect(url) { Log.i(PlayerActivity.TAG, "loading $url") }

    BackHandler {
        if (overlayVisible) onExit() else overlayVisible = true
    }

    // Focus follows the overlay. Releasing the surface's focus doesn't grant it
    // to Compose, so the panel has to claim it once the surface has let go —
    // otherwise its buttons never highlight and the remote does nothing.
    LaunchedEffect(overlayVisible) {
        if (!overlayVisible) {
            delay(120)
            surface?.requestFocus()
        }
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (details == null || waitingForAnime) {
            Loading()
        } else {
            EmbedWebView(
                pageUrl = url,
                focusable = !overlayVisible,
                onSurfaceReady = { surface = it },
                modifier = Modifier.fillMaxSize(),
            )
        }

        if (showHint && !overlayVisible) {
            Text(
                "OK plays and pauses  ·  Back for players and episodes",
                style = MaterialTheme.typography.labelLarge,
                color = Color.White,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(20.dp)
                    .background(Color.Black.copy(alpha = 0.65f))
                    .padding(horizontal = 14.dp, vertical = 8.dp),
            )
        }

        AnimatedVisibility(
            visible = overlayVisible,
            enter = fadeIn() + slideInVertically { it },
            exit = fadeOut() + slideOutVertically { it },
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            ControlsPanel(
                title = details?.displayTitle.orEmpty(),
                isSeries = isSeries,
                season = season,
                episode = episode,
                episodes = episodes,
                serverNames = players.map { it.label },
                activeServer = activeIndex,
                onPlayPause = { surface?.tapCentre() },
                onSeekBack = { repeat(3) { surface?.sendKey(KeyEvent.KEYCODE_DPAD_LEFT) } },
                onSeekForward = { repeat(3) { surface?.sendKey(KeyEvent.KEYCODE_DPAD_RIGHT) } },
                useProxy = useProxy,
                onToggleProxy = {
                    useProxy = !useProxy
                    store.useProxy = useProxy
                },
                onServer = { index ->
                    preferredPlayer = players[index].id
                    store.preferredPlayer = players[index].id
                },
                onEpisode = { number ->
                    episode = number
                    overlayVisible = false
                },
                onPrevious = {
                    when {
                        episode > 1 -> episode -= 1
                        season > 1 -> {
                            season -= 1
                            pendingLastEpisode = true
                        }
                    }
                },
                onNext = {
                    val last = episodes.lastOrNull()?.episodeNumber ?: episode
                    when {
                        episode < last -> episode += 1
                        season < (details?.numberOfSeasons ?: 0) -> {
                            season += 1
                            episode = 1
                        }
                    }
                },
                onResume = { overlayVisible = false },
                onExit = onExit,
            )
        }
    }
}

/**
 * The playback surface, backed by **GeckoView** rather than the system WebView.
 *
 * The target hardware ships Chromium 51 (2016) as its system WebView, which
 * cannot parse the JavaScript the site or any of the providers serve — the page
 * dies on a SyntaxError before a player exists. `android.webkit.WebView` always
 * uses that system engine, so no setting on our side can fix it. GeckoView
 * bundles Mozilla's engine inside the APK instead, which also means it carries
 * its own root-CA store and sidesteps the device's 2016 trust anchors.
 *
 * It loads the site's `/embed` route, exactly as before.
 */
@Composable
private fun EmbedWebView(
    pageUrl: String,
    focusable: Boolean,
    modifier: Modifier = Modifier,
    onSurfaceReady: (View?) -> Unit = {},
) {
    val context = LocalContext.current

    val runtime = remember { GeckoEngine.runtime(context) }

    val session = remember {
        GeckoSession(
            GeckoSessionSettings.Builder()
                // The providers gate on looking like a real browser; the
                // default GeckoView UA already does, unlike a WebView's "wv".
                .usePrivateMode(false)
                .allowJavascript(true)
                .build(),
        ).apply {
            open(runtime)
            navigationDelegate = object : GeckoSession.NavigationDelegate {
                override fun onLoadRequest(
                    session: GeckoSession,
                    request: GeckoSession.NavigationDelegate.LoadRequest,
                ): GeckoResult<AllowOrDeny> {
                    // Ads try to replace the whole page; the player lives in a
                    // frame, so only top-level navigation is worth refusing.
                    if (!request.isDirectNavigation && request.target ==
                        GeckoSession.NavigationDelegate.TARGET_WINDOW_NEW
                    ) {
                        Log.i(PlayerActivity.TAG, "blocked popup: ${request.uri}")
                        return GeckoResult.deny()
                    }
                    return GeckoResult.allow()
                }
            }
            contentDelegate = object : GeckoSession.ContentDelegate {}
        }
    }

    LaunchedEffect(pageUrl) {
        Log.i(PlayerActivity.TAG, "gecko loading $pageUrl")
        session.loadUri(pageUrl)
    }

    DisposableEffect(Unit) {
        onDispose {
            onSurfaceReady(null)
            session.close()
        }
    }

    var view by remember { mutableStateOf<GeckoView?>(null) }

    // Allowing autoplay only helps the <video> element. These providers also
    // gate playback behind their own click-to-play overlay, which is a DOM
    // button — no gesture, no film. So once the page has had a moment to lay
    // itself out, press it: a synthetic tap in the middle, where that button
    // sits. Harmless if playback already started, since the same spot toggles
    // play/pause and this runs once per load.
    LaunchedEffect(pageUrl) {
        delay(4_000)
        view?.let {
            Log.i(PlayerActivity.TAG, "auto-play tap")
            it.tapCentre()
        }
    }

    AndroidView(
        factory = { ctx ->
            GeckoView(ctx).apply {
                setSession(session)
                isFocusableInTouchMode = true
                // OK on the remote is a click in the middle of the player.
                setOnKeyListener { v, keyCode, event ->
                    val isSelect = keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
                        keyCode == KeyEvent.KEYCODE_ENTER ||
                        keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER
                    if (isSelect && event.action == KeyEvent.ACTION_UP) {
                        v.tapCentre()
                        true
                    } else {
                        isSelect
                    }
                }
                view = this
                onSurfaceReady(this)
            }
        },
        modifier = modifier,
        update = { view ->
            view.isFocusable = focusable
            view.isFocusableInTouchMode = focusable
            if (focusable) {
                // Nothing else hands this view focus: there is no touch on a
                // TV, and Compose keeps the window's focus otherwise. Without
                // this the remote's keys never reach the page at all, which is
                // what makes the player's own controls unreachable.
                view.requestFocus()
            } else {
                // While the controls panel is up, the D-pad belongs to it.
                view.clearFocus()
            }
        },
    )
}

/**
 * Sends a key to the page. The embedded players bind the shortcuts a desktop
 * browser would — arrows to seek, space to toggle — and a synthesised event is
 * indistinguishable from a real keypress, which is how we drive a player whose
 * DOM we can't reach across origins.
 */
private fun View.sendKey(keyCode: Int) {
    val now = SystemClock.uptimeMillis()
    dispatchKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, keyCode, 0))
    dispatchKeyEvent(KeyEvent(now, now + 40, KeyEvent.ACTION_UP, keyCode, 0))
}

/** Synthesises a click in the middle of the player, where its controls sit. */
private fun View.tapCentre() {
    val x = width / 2f
    val y = height / 2f
    val now = SystemClock.uptimeMillis()
    val down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, x, y, 0)
    val up = MotionEvent.obtain(now, now + 60, MotionEvent.ACTION_UP, x, y, 0)
    dispatchTouchEvent(down)
    dispatchTouchEvent(up)
    down.recycle()
    up.recycle()
}

@Composable
private fun ControlsPanel(
    title: String,
    isSeries: Boolean,
    season: Int,
    episode: Int,
    episodes: List<Episode>,
    serverNames: List<String>,
    activeServer: Int,
    onPlayPause: () -> Unit,
    onSeekBack: () -> Unit,
    onSeekForward: () -> Unit,
    useProxy: Boolean,
    onToggleProxy: () -> Unit,
    onServer: (Int) -> Unit,
    onEpisode: (Int) -> Unit,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onResume: () -> Unit,
    onExit: () -> Unit,
) {
    val firstControl = remember { FocusRequester() }
    // Retry: the surface may still be releasing focus on the frame this runs.
    LaunchedEffect(Unit) { firstControl.requestFocusWhenReady() }

    Column(
        Modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.94f))))
            .focusGroup()
            .padding(start = ScreenPadding, end = ScreenPadding, top = 40.dp, bottom = 26.dp),
    ) {
        Text(
            title.ifBlank { "Now playing" },
            style = MaterialTheme.typography.titleLarge,
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (isSeries) {
            Text(
                "Season $season · Episode $episode",
                style = MaterialTheme.typography.labelLarge,
                color = Accent,
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        // Transport first: it's what the panel is opened for.
        Row(
            Modifier.padding(top = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TvButton("⏪  Back", onClick = onSeekBack, filled = false)
            TvButton("⏯   Play / Pause", onClick = onPlayPause, focusRequester = firstControl)
            TvButton("Forward  ⏩", onClick = onSeekForward, filled = false)
        }

        Row(
            Modifier.padding(top = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TvButton("Back to film", onClick = onResume, filled = false)
            if (isSeries) {
                TvButton("◀  Previous", onClick = onPrevious, filled = false)
                TvButton("Next  ▶", onClick = onNext, filled = false)
            }
            TvButton("Exit", onClick = onExit, filled = false)
        }

        Text(
            "Video not loading? Try another player.",
            style = MaterialTheme.typography.labelMedium,
            color = Muted,
            modifier = Modifier.padding(top = 16.dp, bottom = 6.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            serverNames.forEachIndexed { index, name ->
                TvChip(name, selected = index == activeServer, onClick = { onServer(index) })
            }
            // Escape hatch for old WebViews: skip our page and load the
            // provider as the top-level document.
            TvChip(
                if (useProxy) "Route: via site" else "Route: direct",
                selected = !useProxy,
                onClick = onToggleProxy,
            )
        }

        if (isSeries && episodes.isNotEmpty()) {
            LazyRow(
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp).focusGroup(),
                contentPadding = PaddingValues(vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                itemsIndexed(episodes, key = { _, ep -> ep.id }) { _, ep ->
                    FocusableCard(
                        imageUrl = TmdbImage.url(ep.stillPath, TmdbImage.STILL),
                        title = "E${ep.episodeNumber} · ${ep.name}",
                        width = 210.dp,
                        aspect = 16f / 9f,
                        onClick = { onEpisode(ep.episodeNumber) },
                    )
                }
            }
        }
    }
}
