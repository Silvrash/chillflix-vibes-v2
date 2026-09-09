package com.chillflixvibes.tv.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.chillflixvibes.tv.data.HOME_SHELVES
import com.chillflixvibes.tv.data.MediaItem
import com.chillflixvibes.tv.data.MediaType
import com.chillflixvibes.tv.data.Preset
import com.chillflixvibes.tv.data.TmdbImage
import com.chillflixvibes.tv.data.TmdbRepository
import com.chillflixvibes.tv.data.WatchStore
import com.chillflixvibes.tv.data.genreNames
import com.chillflixvibes.tv.player.PlayerActivity
import com.chillflixvibes.tv.ui.NavBarHeight
import com.chillflixvibes.tv.ui.components.LoadState
import com.chillflixvibes.tv.ui.components.MediaRow
import com.chillflixvibes.tv.ui.components.HeroScrims
import com.chillflixvibes.tv.ui.components.RatingBadge
import com.chillflixvibes.tv.ui.components.RowPlaceholder
import com.chillflixvibes.tv.ui.components.ScreenPadding
import com.chillflixvibes.tv.ui.components.TvButton
import com.chillflixvibes.tv.ui.components.TvImage
import com.chillflixvibes.tv.ui.components.glass
import com.chillflixvibes.tv.ui.components.rememberLoad
import com.chillflixvibes.tv.ui.components.requestFocusWhenReady
import com.chillflixvibes.tv.ui.rememberResumeTick
import com.chillflixvibes.tv.ui.theme.Accent
import com.chillflixvibes.tv.ui.theme.Background
import com.chillflixvibes.tv.ui.theme.Muted
import com.chillflixvibes.tv.ui.theme.PillShape

/**
 * The launcher screen: a full-bleed hero for the top trending title, a
 * "Continue watching" shelf, then the curated shelves.
 *
 * The hero takes the entire panel. TV panels and TMDB backdrops are both 16:9,
 * so filling the screen is the one size at which the artwork is shown exactly
 * as it was published — any shorter hero would have to crop it.
 *
 * Shelves load independently and only when they scroll into view, so the first
 * screenful is up quickly on TV hardware.
 */
@Composable
fun HomeScreen(
    onOpen: (MediaType, Int) -> Unit,
    onSeeAll: (String) -> Unit = {},
    modifier: Modifier = Modifier,
    /** Attached to this screen's root so the nav bar can send focus down into it. */
    contentFocus: FocusRequester = remember { FocusRequester() },
    /** Where Up from the top row of content should land. */
    navFocus: FocusRequester? = null,
) {
    val context = LocalContext.current
    val repo = remember { TmdbRepository.get(context) }
    val store = remember { WatchStore(context) }

    // Re-read local playback state whenever we come back from the player, so
    // "Continue watching" reflects the episode that just finished.
    val resumeTick = rememberResumeTick()
    val continueWatching = remember(resumeTick) { store.continueWatching() }

    val trending = rememberLoad { repo.trending("day") }
    val hero = (trending as? LoadState.Success)?.value?.firstOrNull()

    // Land on the hero's Play button once there's a hero to play — the first
    // thing the remote touches should be the thing you came here to press.
    LaunchedEffect(hero) {
        if (hero != null) contentFocus.requestFocusWhenReady()
    }

    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    // The hero's "more below" nudge is only true while the hero is actually
    // filling the screen — once you've scrolled it would just be stranded text.
    val atTop by remember {
        derivedStateOf { listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset < 40 }
    }

    BoxWithConstraints(modifier.fillMaxSize().background(Background)) {
        val heroHeight = maxHeight

        LazyColumn(Modifier.fillMaxSize(), state = listState) {
            item(key = "hero") {
                when (trending) {
                    is LoadState.Success -> hero?.let { item ->
                        val heroType = item.mediaType(MediaType.MOVIE)
                        Hero(
                            item = item,
                            height = heroHeight,
                            showScrollHint = atTop,
                            navFocus = navFocus,
                            playFocus = contentFocus,
                            // Coming back up to the hero should re-expand it,
                            // not leave it clipped behind the nav bar.
                            onFocused = {
                                scope.launch {
                                    // Let Compose's own bring-into-view scroll
                                    // settle first, then take the list home.
                                    delay(60)
                                    listState.animateScrollToItem(0)
                                }
                            },
                            onPlay = {
                                // Pick up where the user left off if they've
                                // started this title before.
                                val (season, episode) = store.lastWatched(heroType, item.id)
                                PlayerActivity.start(context, heroType, item.id, season, episode)
                            },
                            onDetails = { onOpen(heroType, item.id) },
                        )
                    }
                    is LoadState.Failed -> HeroError(heroHeight)
                    LoadState.Loading -> Box(Modifier.fillMaxWidth().height(heroHeight))
                }
            }

            if (continueWatching.isNotEmpty()) {
                item(key = "continue") {
                    MediaRow(
                        title = "Continue Watching",
                        items = continueWatching.map { it.toMediaItem() },
                        fallbackType = MediaType.TV,
                        onSelect = { item, type -> onOpen(type, item.id) },
                        modifier = Modifier.padding(top = 34.dp),
                    )
                }
            }

            item(key = "trending-row") {
                MediaRow(
                    title = "Trending Today",
                    items = (trending as? LoadState.Success)?.value.orEmpty(),
                    fallbackType = MediaType.MOVIE,
                    onSelect = { item, type -> onOpen(type, item.id) },
                    modifier = Modifier.padding(top = if (continueWatching.isEmpty()) 34.dp else 0.dp),
                )
            }

            items(HOME_SHELVES.size, key = { HOME_SHELVES[it].name }) { index ->
                PresetRow(preset = HOME_SHELVES[index], onOpen = onOpen, onSeeAll = onSeeAll)
            }

            item(key = "bottom-spacer") { Box(Modifier.height(48.dp)) }
        }
    }
}

@Composable
private fun PresetRow(preset: Preset, onOpen: (MediaType, Int) -> Unit, onSeeAll: (String) -> Unit) {
    val context = LocalContext.current
    val repo = remember { TmdbRepository.get(context) }
    val state = rememberLoad(preset.name) { repo.discover(preset.type, preset.filters).results }

    when (state) {
        is LoadState.Success -> MediaRow(
            title = preset.name,
            items = state.value,
            fallbackType = preset.type,
            onSelect = { item, type -> onOpen(type, item.id) },
            onSeeAll = { onSeeAll(preset.name) },
        )
        LoadState.Loading -> RowPlaceholder()
        is LoadState.Failed -> Unit // a shelf that fails to load is simply left out
    }
}

@Composable
private fun Hero(
    item: MediaItem,
    height: Dp,
    showScrollHint: Boolean,
    navFocus: FocusRequester?,
    playFocus: FocusRequester,
    onFocused: () -> Unit,
    onPlay: () -> Unit,
    onDetails: () -> Unit,
) {
    Box(Modifier.fillMaxWidth().height(height)) {
        TvImage(
            url = TmdbImage.url(item.backdropPath, TmdbImage.BACKDROP),
            contentDescription = item.displayTitle,
            alignment = Alignment.TopCenter,
            modifier = Modifier.fillMaxSize(),
        )
        HeroScrims()

        Column(
            Modifier
                .align(Alignment.BottomStart)
                .padding(start = ScreenPadding, end = ScreenPadding, bottom = 60.dp)
                .fillMaxWidth(0.56f),
        ) {
            Text(
                item.displayTitle,
                style = MaterialTheme.typography.displayLarge,
                color = Color.White,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Row(
                Modifier.padding(top = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                if (item.voteAverage > 0) RatingBadge(item.voteAverage)
                Text(
                    listOfNotNull(item.year, genreNames(item.genreIds).takeIf { it.isNotBlank() })
                        .joinToString("  ·  "),
                    style = MaterialTheme.typography.labelLarge,
                    color = Accent,
                )
            }
            if (item.overview.isNotBlank()) {
                Text(
                    item.overview,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.8f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 14.dp),
                )
            }
            Row(
                Modifier
                    .padding(top = 22.dp)
                    // Up from the hero buttons reaches the floating nav bar.
                    .then(navFocus?.let { Modifier.focusProperties { up = it } } ?: Modifier),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                TvButton(
                    label = "Play",
                    icon = Icons.Filled.PlayArrow,
                    onClick = onPlay,
                    focusRequester = playFocus,
                    onFocused = onFocused,
                )
                TvButton(
                    label = "More info",
                    icon = Icons.Filled.Info,
                    onClick = onDetails,
                    filled = false,
                    onFocused = onFocused,
                )
            }
        }

        // The shelves start below the fold, so say so — but only while the
        // hero owns the screen.
        if (showScrollHint) {
            Text(
                "▾   More below",
                style = MaterialTheme.typography.labelMedium,
                color = Muted,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 24.dp)
                    .glass(PillShape)
                    .padding(horizontal = 16.dp, vertical = 7.dp),
            )
        }
    }
}

@Composable
private fun HeroError(height: Dp) {
    Box(
        Modifier.fillMaxWidth().height(height).padding(start = ScreenPadding, end = ScreenPadding, top = NavBarHeight),
        contentAlignment = Alignment.CenterStart,
    ) {
        Column {
            Text("Couldn't reach ChillFlixVibes", style = MaterialTheme.typography.headlineSmall, color = Color.White)
            Text(
                "Check the TV's network connection, then press Back and reopen the app.",
                style = MaterialTheme.typography.bodyMedium,
                color = Muted,
                modifier = Modifier.padding(top = 10.dp),
            )
        }
    }
}
