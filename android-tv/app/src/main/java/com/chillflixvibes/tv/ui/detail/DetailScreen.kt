package com.chillflixvibes.tv.ui.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.chillflixvibes.tv.data.MediaType
import com.chillflixvibes.tv.data.TmdbImage
import com.chillflixvibes.tv.data.TmdbRepository
import com.chillflixvibes.tv.data.WatchStore
import com.chillflixvibes.tv.player.PlayerActivity
import com.chillflixvibes.tv.ui.components.ErrorState
import com.chillflixvibes.tv.ui.components.FocusableCard
import com.chillflixvibes.tv.ui.components.LoadState
import com.chillflixvibes.tv.ui.components.Loading
import com.chillflixvibes.tv.ui.components.MediaRow
import com.chillflixvibes.tv.ui.components.ScreenPadding
import com.chillflixvibes.tv.ui.components.TvButton
import com.chillflixvibes.tv.ui.components.TvChip
import com.chillflixvibes.tv.ui.components.TvImage
import com.chillflixvibes.tv.ui.components.rememberLoad
import com.chillflixvibes.tv.ui.components.requestFocusWhenReady
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.chillflixvibes.tv.ui.rememberResumeTick
import com.chillflixvibes.tv.ui.theme.Accent
import com.chillflixvibes.tv.ui.theme.Background
import com.chillflixvibes.tv.ui.theme.Muted

/**
 * Title page: artwork and metadata up top, then — for a series — season chips
 * and an episode shelf, cast, and recommendations.
 *
 * The Play button is the first thing focused, so a title is two presses from
 * playing: OK on the poster, OK on Play.
 */
@Composable
fun DetailScreen(
    type: MediaType,
    id: Int,
    onOpen: (MediaType, Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val repo = remember { TmdbRepository.get(context) }
    val store = remember { WatchStore(context) }
    val playFocus = remember { FocusRequester() }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    val detailsState = rememberLoad(type, id) { repo.details(type, id) }
    val recommendations = rememberLoad(type, id) { runCatching { repo.recommendations(type, id) }.getOrDefault(emptyList()) }

    // Refresh the resume position when returning from playback.
    val resumeTick = rememberResumeTick()
    val (savedSeason, savedEpisode) = remember(resumeTick, type, id) { store.lastWatched(type, id) }
    val hasProgress = remember(resumeTick, type, id) { store.hasProgress(type, id) }

    var selectedSeason by remember(id) { mutableIntStateOf(savedSeason) }
    LaunchedEffect(savedSeason) { selectedSeason = savedSeason }

    when (detailsState) {
        LoadState.Loading -> Loading(modifier.fillMaxSize().background(Background))
        is LoadState.Failed -> ErrorState(
            "Couldn't load this title. Check the TV's connection and try again.",
            modifier.fillMaxSize().background(Background),
        )
        is LoadState.Success -> {
            val details = detailsState.value
            val isSeries = type == MediaType.TV
            val seasonNumbers = details.airedSeasons.map { it.seasonNumber }
            val season = rememberLoad(id, selectedSeason, isSeries) {
                if (isSeries) runCatching { repo.season(id, selectedSeason) }.getOrNull() else null
            }
            val episodes = (season as? LoadState.Success)?.value?.episodes.orEmpty()

            LaunchedEffect(details.id) { playFocus.requestFocusWhenReady() }

            BoxWithConstraints(modifier.fillMaxSize().background(Background)) {
            // Same reasoning as the home hero: a full-panel 16:9 slot is the
            // only size that shows a 16:9 backdrop without cropping it.
            val heroHeight = maxHeight

            // Focusing a hero button pulls the list back to the top, so the
            // artwork re-expands instead of leaving the button stranded at the
            // top edge of the screen.
            val snapToHero: () -> Unit = {
                scope.launch {
                    delay(60)
                    listState.animateScrollToItem(0)
                }
            }

            LazyColumn(Modifier.fillMaxSize(), state = listState) {
                item(key = "hero") {
                    Box(Modifier.fillMaxWidth().height(heroHeight)) {
                        TvImage(
                            url = TmdbImage.url(details.backdropPath, TmdbImage.BACKDROP),
                            contentDescription = details.displayTitle,
                            alignment = Alignment.TopCenter,
                            modifier = Modifier.fillMaxSize(),
                        )
                        Box(
                            Modifier.fillMaxSize().background(
                                Brush.horizontalGradient(
                                    0f to Background,
                                    0.42f to Background.copy(alpha = 0.82f),
                                    0.78f to Color.Transparent,
                                ),
                            )
                        )
                        Box(
                            Modifier.fillMaxSize().background(
                                Brush.verticalGradient(
                                    0f to Background.copy(alpha = 0.45f),
                                    0.35f to Color.Transparent,
                                    0.72f to Background.copy(alpha = 0.75f),
                                    1f to Background,
                                ),
                            )
                        )

                        Column(
                            Modifier
                                .align(Alignment.BottomStart)
                                .padding(start = ScreenPadding, end = ScreenPadding, bottom = 44.dp)
                                .fillMaxWidth(0.58f),
                        ) {
                            Text(
                                details.displayTitle,
                                style = MaterialTheme.typography.displaySmall,
                                color = Color.White,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                listOfNotNull(
                                    details.voteAverage.takeIf { it > 0 }?.let { "★ " + String.format("%.1f", it) },
                                    details.year,
                                    details.runtimeMinutes?.let { "$it min" },
                                    details.numberOfSeasons.takeIf { it > 0 }
                                        ?.let { "$it Season" + if (it > 1) "s" else "" },
                                    details.genres.take(3).joinToString(" · ") { it.name }.takeIf { it.isNotBlank() },
                                ).joinToString("  ·  "),
                                style = MaterialTheme.typography.labelLarge,
                                color = Accent,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                            if (details.overview.isNotBlank()) {
                                Text(
                                    details.overview,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Muted,
                                    maxLines = 3,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.padding(top = 10.dp),
                                )
                            }

                            Row(
                                Modifier.padding(top = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                val resumeLabel = when {
                                    !isSeries -> if (hasProgress) "▶  Resume" else "▶  Play"
                                    hasProgress -> "▶  Resume S$savedSeason · E$savedEpisode"
                                    else -> "▶  Play S1 · E1"
                                }
                                TvButton(
                                    label = resumeLabel,
                                    focusRequester = playFocus,
                                    onFocused = snapToHero,
                                    onClick = {
                                        PlayerActivity.start(
                                            context = context,
                                            type = type,
                                            id = id,
                                            season = if (isSeries) savedSeason else 1,
                                            episode = if (isSeries) savedEpisode else 1,
                                        )
                                    },
                                )
                                if (isSeries && hasProgress) {
                                    TvButton(
                                        label = "Start from S1 · E1",
                                        filled = false,
                                        onFocused = snapToHero,
                                        onClick = { PlayerActivity.start(context, type, id, 1, 1) },
                                    )
                                }
                            }
                        }
                    }
                }

                if (isSeries && seasonNumbers.size > 1) {
                    item(key = "seasons") {
                        LazyRow(
                            modifier = Modifier.fillMaxWidth().focusGroup(),
                            contentPadding = PaddingValues(horizontal = ScreenPadding, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            items(seasonNumbers, key = { it }) { number ->
                                TvChip(
                                    label = "Season $number",
                                    selected = number == selectedSeason,
                                    onClick = { selectedSeason = number },
                                )
                            }
                        }
                    }
                }

                if (isSeries) {
                    item(key = "episodes") {
                        Column(Modifier.padding(top = 8.dp, bottom = 18.dp)) {
                            Text(
                                "Episodes",
                                style = MaterialTheme.typography.titleLarge,
                                color = Color.White,
                                modifier = Modifier.padding(start = ScreenPadding, bottom = 10.dp),
                            )
                            if (episodes.isEmpty()) {
                                Text(
                                    if (season is LoadState.Loading) "Loading episodes…" else "No episodes listed for this season.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Muted,
                                    modifier = Modifier.padding(horizontal = ScreenPadding, vertical = 20.dp),
                                )
                            } else {
                                LazyRow(
                                    modifier = Modifier.fillMaxWidth().focusGroup(),
                                    contentPadding = PaddingValues(horizontal = ScreenPadding, vertical = 10.dp),
                                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                                ) {
                                    itemsIndexed(episodes, key = { _, ep -> ep.id }) { _, ep ->
                                        FocusableCard(
                                            imageUrl = TmdbImage.url(ep.stillPath, TmdbImage.STILL),
                                            title = "E${ep.episodeNumber} · ${ep.name}",
                                            subtitle = ep.airDate,
                                            width = 260.dp,
                                            aspect = 16f / 9f,
                                            onClick = {
                                                PlayerActivity.start(context, type, id, selectedSeason, ep.episodeNumber)
                                            },
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                val cast = details.credits?.cast.orEmpty().filter { it.profilePath != null }.take(20)
                if (cast.isNotEmpty()) {
                    item(key = "cast") {
                        Column(Modifier.padding(bottom = 18.dp)) {
                            Text(
                                "Cast",
                                style = MaterialTheme.typography.titleLarge,
                                color = Color.White,
                                modifier = Modifier.padding(start = ScreenPadding, bottom = 10.dp),
                            )
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = ScreenPadding, vertical = 6.dp),
                                horizontalArrangement = Arrangement.spacedBy(20.dp),
                            ) {
                                items(cast, key = { it.id }) { member ->
                                    Column(
                                        Modifier.width(110.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                    ) {
                                        TvImage(
                                            url = TmdbImage.url(member.profilePath, TmdbImage.PROFILE),
                                            contentDescription = member.name,
                                            modifier = Modifier.size(96.dp).clip(CircleShape),
                                        )
                                        Text(
                                            member.name,
                                            style = MaterialTheme.typography.labelMedium,
                                            color = Color.White,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            modifier = Modifier.padding(top = 8.dp),
                                        )
                                        Text(
                                            member.character,
                                            style = MaterialTheme.typography.labelMedium,
                                            color = Muted,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                item(key = "recommendations") {
                    val items = (recommendations as? LoadState.Success)?.value.orEmpty()
                    MediaRow(
                        title = "More Like This",
                        items = items,
                        fallbackType = type,
                        onSelect = { item, itemType -> onOpen(itemType, item.id) },
                    )
                }

                item(key = "bottom-spacer") { Box(Modifier.height(40.dp)) }
            }
            }
        }
    }
}
