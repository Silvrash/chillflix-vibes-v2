package com.chillflixvibes.tv.ui.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.chillflixvibes.tv.data.MediaDetails
import com.chillflixvibes.tv.data.MediaType
import com.chillflixvibes.tv.data.TmdbImage
import com.chillflixvibes.tv.data.TmdbRepository
import com.chillflixvibes.tv.data.WatchStore
import com.chillflixvibes.tv.player.PlayerActivity
import com.chillflixvibes.tv.ui.components.ErrorState
import com.chillflixvibes.tv.ui.components.FocusableCard
import com.chillflixvibes.tv.ui.components.HeroScrims
import com.chillflixvibes.tv.ui.components.LoadState
import com.chillflixvibes.tv.ui.components.Loading
import com.chillflixvibes.tv.ui.components.MediaRow
import com.chillflixvibes.tv.ui.components.MetaPill
import com.chillflixvibes.tv.ui.components.RatingBadge
import com.chillflixvibes.tv.ui.components.ScreenPadding
import com.chillflixvibes.tv.ui.components.SectionHeading
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
import com.chillflixvibes.tv.ui.theme.CardShape
import com.chillflixvibes.tv.ui.theme.Hairline
import com.chillflixvibes.tv.ui.theme.Muted

/**
 * Title page: a full-bleed backdrop with the poster and metadata over it, then
 * — for a series — season chips and an episode shelf, cast, and
 * recommendations.
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
                        HeroScrims()

                        Row(
                            Modifier
                                .align(Alignment.BottomStart)
                                .padding(start = ScreenPadding, end = ScreenPadding, bottom = 52.dp)
                                .fillMaxWidth(0.84f),
                            verticalAlignment = Alignment.Bottom,
                        ) {
                            Poster(details)
                            Column(Modifier.padding(start = 32.dp).weight(1f)) {
                                Text(
                                    details.displayTitle,
                                    style = MaterialTheme.typography.displayLarge,
                                    color = Color.White,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                if (details.tagline.isNotBlank()) {
                                    Text(
                                        details.tagline,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontStyle = FontStyle.Italic,
                                        color = Color.White.copy(alpha = 0.6f),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.padding(top = 8.dp),
                                    )
                                }

                                Row(
                                    Modifier.padding(top = 14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                                ) {
                                    if (details.voteAverage > 0) RatingBadge(details.voteAverage)
                                    Text(
                                        listOfNotNull(
                                            details.year,
                                            details.runtimeMinutes?.let { "$it min" },
                                            details.numberOfSeasons.takeIf { it > 0 }
                                                ?.let { "$it Season" + if (it > 1) "s" else "" },
                                        ).joinToString("  ·  "),
                                        style = MaterialTheme.typography.labelLarge,
                                        color = Accent,
                                    )
                                }

                                if (details.genres.isNotEmpty()) {
                                    Row(
                                        Modifier.padding(top = 14.dp),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    ) {
                                        details.genres.take(4).forEach { MetaPill(it.name) }
                                    }
                                }

                                if (details.overview.isNotBlank()) {
                                    Text(
                                        details.overview,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = Color.White.copy(alpha = 0.8f),
                                        maxLines = 3,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.padding(top = 14.dp),
                                    )
                                }

                                Row(
                                    Modifier.padding(top = 18.dp),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    val resumeLabel = when {
                                        !isSeries -> if (hasProgress) "Resume" else "Play"
                                        hasProgress -> "Resume S$savedSeason · E$savedEpisode"
                                        else -> "Play S1 · E1"
                                    }
                                    TvButton(
                                        label = resumeLabel,
                                        icon = Icons.Filled.PlayArrow,
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
                }

                if (isSeries && seasonNumbers.size > 1) {
                    item(key = "seasons") {
                        LazyRow(
                            modifier = Modifier.fillMaxWidth().focusGroup(),
                            contentPadding = PaddingValues(horizontal = ScreenPadding, vertical = 14.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
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
                        Column(Modifier.padding(top = 10.dp, bottom = 30.dp)) {
                            SectionHeading("Episodes")
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
                                    horizontalArrangement = Arrangement.spacedBy(18.dp),
                                ) {
                                    itemsIndexed(episodes, key = { _, ep -> ep.id }) { _, ep ->
                                        FocusableCard(
                                            imageUrl = TmdbImage.url(ep.stillPath, TmdbImage.STILL),
                                            title = "E${ep.episodeNumber} · ${ep.name}",
                                            subtitle = ep.airDate,
                                            width = 290.dp,
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
                        Column(Modifier.padding(bottom = 30.dp)) {
                            SectionHeading("Cast")
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = ScreenPadding, vertical = 6.dp),
                                horizontalArrangement = Arrangement.spacedBy(24.dp),
                            ) {
                                items(cast, key = { it.id }) { member ->
                                    Column(
                                        Modifier.width(124.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                    ) {
                                        TvImage(
                                            url = TmdbImage.url(member.profilePath, TmdbImage.PROFILE),
                                            contentDescription = member.name,
                                            modifier = Modifier
                                                .size(112.dp)
                                                .clip(CircleShape)
                                                .border(1.dp, Hairline, CircleShape),
                                        )
                                        Text(
                                            member.name,
                                            style = MaterialTheme.typography.labelMedium,
                                            color = Color.White,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            modifier = Modifier.padding(top = 10.dp),
                                        )
                                        Text(
                                            member.character,
                                            style = MaterialTheme.typography.labelSmall,
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

                item(key = "bottom-spacer") { Box(Modifier.height(48.dp)) }
            }
            }
        }
    }
}

/** The poster beside the title, as on the web's detail page. */
@Composable
private fun Poster(details: MediaDetails) {
    Box(
        Modifier
            .width(172.dp)
            .height(258.dp)
            .clip(CardShape)
            .border(1.dp, Hairline, CardShape),
    ) {
        TvImage(
            url = TmdbImage.url(details.posterPath),
            contentDescription = details.displayTitle,
            modifier = Modifier.fillMaxSize(),
        )
    }
}
