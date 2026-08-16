package com.chillflixvibes.tv.player

import android.annotation.SuppressLint
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
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
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
import com.chillflixvibes.tv.R
import com.chillflixvibes.tv.data.Episode
import com.chillflixvibes.tv.data.MediaType
import com.chillflixvibes.tv.data.TmdbImage
import com.chillflixvibes.tv.data.TmdbRepository
import com.chillflixvibes.tv.data.WatchEntry
import com.chillflixvibes.tv.data.WatchStore
import com.chillflixvibes.tv.data.serversFor
import com.chillflixvibes.tv.ui.components.FocusableCard
import com.chillflixvibes.tv.ui.components.LoadState
import com.chillflixvibes.tv.ui.components.Loading
import com.chillflixvibes.tv.ui.components.ScreenPadding
import com.chillflixvibes.tv.ui.components.TvButton
import com.chillflixvibes.tv.ui.components.TvChip
import com.chillflixvibes.tv.ui.components.rememberLoad
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
    val servers = remember(details, anilistId) {
        serversFor(type, details?.isAnime == true, anilistId)
    }
    var serverIndex by remember { mutableIntStateOf(store.preferredServer) }
    val activeIndex = serverIndex.coerceIn(0, servers.lastIndex)
    val server = servers[activeIndex]

    // The app doesn't build provider URLs any more: it points the WebView at
    // the site's chrome-less `/embed` route, which hosts the same iframe the
    // web app uses. That page is served from the real origin over https, so
    // the provider sees the referrer, headers and page context it expects —
    // conditions a WebView-local page can't reproduce. The lineup below is
    // only used for the "Player 1/2/3" labels; `server` is passed as an index.
    val siteUrl = remember { context.getString(R.string.api_base_url).trimEnd('/') }
    val url = remember(siteUrl, type, id, season, episode, activeIndex, anilistId, isSeries) {
        buildString {
            append("$siteUrl/embed/${type.slug}/$id?server=$activeIndex")
            if (isSeries) append("&season=$season&episode=$episode")
            if (anilistId != null) append("&anilist=$anilistId")
        }
    }

    BackHandler {
        if (overlayVisible) onExit() else overlayVisible = true
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (details == null || waitingForAnime) {
            Loading()
        } else {
            EmbedWebView(
                pageUrl = url,
                focusable = !overlayVisible,
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
                serverNames = servers.map { it.name },
                activeServer = activeIndex,
                onServer = { index ->
                    serverIndex = index
                    store.preferredServer = index
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
 * Hosts the embed the same way the website does: inside an `<iframe>` on a page
 * served from our own origin, with `referrerpolicy="origin"` and the same
 * `allow` list as `components/player/Player.tsx`.
 *
 * This matters — loading a provider's embed as the *top-level* document is a
 * different environment from the one it is built for: it sees itself unframed
 * and gets a different (or absent) referrer, and the players respond by serving
 * ads or nothing at all instead of the stream. Wrapping it restores the
 * conditions the provider expects.
 *
 * The wrapper also gives us a clean security boundary: the player and its ads
 * live in the frame, so *any* top-level navigation is an ad trying to escape,
 * and gets refused. A stray tab is close to unrecoverable with a remote.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun EmbedWebView(
    pageUrl: String,
    focusable: Boolean,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    // The page is served under the site's own origin so the iframe's
    // `referrerpolicy="origin"` sends the provider the same referrer the web
    // app does.
    val siteUrl = context.getString(R.string.api_base_url).trimEnd('/') + "/"
    val siteHost = remember(siteUrl) { Uri.parse(siteUrl).host }
    var customView by remember { mutableStateOf<View?>(null) }

    val webView = remember {
        WebView(context).apply {
            with(settings) {
                javaScriptEnabled = true
                domStorageEnabled = true
                // Playback must start without a tap — there isn't one on a TV.
                mediaPlaybackRequiresUserGesture = false
                // Let `window.open()` succeed. These players check that their
                // pop-under actually opened and refuse to serve a stream when
                // it didn't, so refusing outright costs us playback — the
                // window is granted below, then thrown away unseen.
                javaScriptCanOpenWindowsAutomatically = true
                setSupportMultipleWindows(true)
                loadWithOverviewMode = true
                useWideViewPort = true
                cacheMode = WebSettings.LOAD_DEFAULT
                // Embed players routinely mix http sub-resources into an https
                // page; refusing them just yields a black frame.
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                // A WebView announces itself with "; wv" in the User-Agent.
                // The providers front their CDNs with Cloudflare and bot
                // detection (Adscore), which treat that marker differently
                // from a real browser — and the resulting 403 on the manifest
                // surfaces as a CORS error and a black screen. Presenting the
                // same UA string minus the marker is what the site itself
                // sends from the TV's browser.
                userAgentString = userAgentString.replace("; wv", "")
            }
            setBackgroundColor(android.graphics.Color.BLACK)

            // The embedded players are built for a mouse: their big centre
            // Play button (and play/pause toggle) responds to a click, and a
            // D-pad produces key events, not clicks — which is precisely why
            // watching on a TV browser meant dragging a cursor around. OK on
            // the remote is therefore translated into a tap at the centre of
            // the player, where that button lives.
            setOnKeyListener { view, keyCode, event ->
                val isSelect = keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
                    keyCode == KeyEvent.KEYCODE_ENTER ||
                    keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER
                if (isSelect && event.action == KeyEvent.ACTION_UP) {
                    (view as WebView).tapCentre()
                    true
                } else {
                    isSelect // swallow the matching DOWN so the page sees one event
                }
            }

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    // Sub-frames and sub-resources are the player's business.
                    if (!request.isForMainFrame) return false
                    // The top-level document is our own /embed page; the
                    // provider lives in its iframe. So anything trying to
                    // replace the page itself is an ad escaping.
                    if (request.url.host == siteHost) return false
                    // Ads now get their own off-screen window via
                    // onCreateWindow, so anything still trying to replace the
                    // page itself is a redirect we don't want on a TV.
                    Log.i(PlayerActivity.TAG, "blocked top-level navigation: ${request.url}")
                    return true
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: android.webkit.WebResourceError,
                ) {
                    if (request.isForMainFrame) {
                        Log.w(PlayerActivity.TAG, "load failed ${request.url}: ${error.description}")
                    }
                }
            }

            webChromeClient = object : WebChromeClient() {
                /**
                 * Pop-unders get a real, working window — just one that is
                 * never attached to the view hierarchy, so it loads out of
                 * sight and is destroyed shortly after. The page's check
                 * passes, nothing lands on the TV screen, and there is no
                 * stray tab for the remote to get lost in.
                 */
                override fun onCreateWindow(
                    view: WebView,
                    isDialog: Boolean,
                    isUserGesture: Boolean,
                    resultMsg: android.os.Message,
                ): Boolean {
                    val sink = WebView(view.context).apply {
                        settings.javaScriptEnabled = true
                        webViewClient = WebViewClient()
                    }
                    (resultMsg.obj as WebView.WebViewTransport).webView = sink
                    resultMsg.sendToTarget()
                    // Long enough for the ad network to register the open.
                    sink.postDelayed({ sink.destroy() }, 15_000)
                    Log.i(PlayerActivity.TAG, "pop-under opened off-screen")
                    return true
                }

                // jwplayer's fullscreen button hands us a view to host.
                override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                    val root = rootView as? ViewGroup ?: return
                    customView?.let { root.removeView(it) }
                    customView = view
                    root.addView(
                        view,
                        ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT,
                        ),
                    )
                }

                override fun onHideCustomView() {
                    val root = rootView as? ViewGroup
                    customView?.let { root?.removeView(it) }
                    customView = null
                }
            }
        }
    }

    LaunchedEffect(pageUrl) { webView.loadUrl(pageUrl) }

    DisposableEffect(Unit) {
        onDispose {
            webView.loadUrl("about:blank")
            webView.destroy()
        }
    }

    AndroidView(
        factory = { webView },
        modifier = modifier,
        update = { view ->
            // While the controls panel is up, the D-pad belongs to it, not to
            // the page underneath.
            view.isFocusable = focusable
            view.isFocusableInTouchMode = focusable
            if (!focusable) view.clearFocus()
        },
    )
}

/** Synthesises a click in the middle of the player, where its controls sit. */
private fun WebView.tapCentre() {
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
    onServer: (Int) -> Unit,
    onEpisode: (Int) -> Unit,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onResume: () -> Unit,
    onExit: () -> Unit,
) {
    val firstControl = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { firstControl.requestFocus() } }

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

        Row(
            Modifier.padding(top = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TvButton("Resume", onClick = onResume, focusRequester = firstControl)
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
