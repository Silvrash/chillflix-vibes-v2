package com.chillflixvibes.tv.ui.browse

import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.chillflixvibes.tv.data.MediaItem
import com.chillflixvibes.tv.data.MediaType
import com.chillflixvibes.tv.data.Section
import com.chillflixvibes.tv.data.TmdbImage
import com.chillflixvibes.tv.data.TmdbRepository
import com.chillflixvibes.tv.data.presetsFor
import com.chillflixvibes.tv.ui.components.FocusableCard
import com.chillflixvibes.tv.ui.components.Loading
import com.chillflixvibes.tv.ui.components.ScreenPadding
import com.chillflixvibes.tv.ui.components.TvChip
import com.chillflixvibes.tv.ui.components.requestFocusWhenReady
import com.chillflixvibes.tv.ui.theme.Background
import com.chillflixvibes.tv.ui.theme.Muted

/**
 * A section (Movies / TV Shows / Anime): the section's curated shelves as a row
 * of chips at the top, and the selected shelf as an infinite poster grid.
 *
 * Pages load as you approach the end of the grid, so holding the D-pad down
 * keeps producing posters instead of stopping at 20.
 */
@Composable
fun BrowseScreen(
    section: Section,
    onOpen: (MediaType, Int) -> Unit,
    modifier: Modifier = Modifier,
    /** Space kept clear at the top for the floating nav bar. */
    topInset: Dp = 0.dp,
    /** Attached to this screen's root so the nav bar can send focus down into it. */
    contentFocus: FocusRequester = remember { FocusRequester() },
    /** Where Up from the preset row should land. */
    navFocus: FocusRequester? = null,
) {
    val context = LocalContext.current
    val repo = remember { TmdbRepository.get(context) }
    val presets = remember(section) { presetsFor(section) }

    var presetIndex by remember(section) { mutableIntStateOf(0) }
    val preset = presets[presetIndex]

    val items = remember(section, presetIndex) { mutableStateListOf<MediaItem>() }
    var page by remember(section, presetIndex) { mutableIntStateOf(1) }
    var totalPages by remember(section, presetIndex) { mutableIntStateOf(1) }
    var loading by remember(section, presetIndex) { mutableStateOf(true) }
    var failed by remember(section, presetIndex) { mutableStateOf(false) }

    LaunchedEffect(section, presetIndex, page) {
        loading = true
        runCatching { repo.discover(preset.type, preset.filters, page) }
            .onSuccess { response ->
                // De-dupe: TMDB can repeat a title across pages when sorting by
                // popularity, and duplicate keys crash a lazy grid.
                val existing = items.mapTo(HashSet()) { it.id }
                items += response.results.filter { existing.add(it.id) }
                totalPages = response.totalPages
                failed = false
            }
            .onFailure { failed = true }
        loading = false
    }

    val gridState = rememberLazyGridState()
    // Fetch the next page once focus/scroll gets within a row or two of the end.
    val nearEnd by remember(items) {
        derivedStateOf {
            val last = gridState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: return@derivedStateOf false
            items.isNotEmpty() && last >= items.size - 12
        }
    }
    LaunchedEffect(nearEnd, loading, page) {
        if (nearEnd && !loading && page < totalPages) page += 1
    }

    LaunchedEffect(section) { contentFocus.requestFocusWhenReady() }

    Column(modifier.fillMaxSize().background(Background).padding(top = topInset)) {
        LazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .then(navFocus?.let { Modifier.focusProperties { up = it } } ?: Modifier)
                .focusGroup(),
            contentPadding = PaddingValues(horizontal = ScreenPadding, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            itemsIndexed(presets, key = { _, item -> item.name }) { index, item ->
                TvChip(
                    label = item.name,
                    selected = index == presetIndex,
                    onClick = { presetIndex = index },
                    // The first chip is where the nav bar drops focus.
                    focusRequester = contentFocus.takeIf { index == 0 },
                )
            }
        }

        when {
            items.isEmpty() && loading -> Loading()
            items.isEmpty() && failed -> EmptyState("Couldn't load ${preset.name}. Check the TV's connection.")
            items.isEmpty() -> EmptyState("Nothing matched ${preset.name}.")
            else -> LazyVerticalGrid(
                columns = GridCells.Adaptive(160.dp),
                state = gridState,
                modifier = Modifier.fillMaxSize().focusGroup(),
                contentPadding = PaddingValues(
                    start = ScreenPadding,
                    end = ScreenPadding,
                    top = 12.dp,
                    bottom = 32.dp,
                ),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                items(items, key = { it.id }) { item ->
                    FocusableCard(
                        imageUrl = TmdbImage.url(item.posterPath),
                        title = item.displayTitle,
                        subtitle = item.year,
                        width = null, // fill the grid cell
                        onClick = { onOpen(item.mediaType(preset.type), item.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun EmptyState(message: String) {
    Box(Modifier.fillMaxSize().padding(ScreenPadding), contentAlignment = Alignment.Center) {
        Text(message, style = MaterialTheme.typography.bodyLarge, color = Muted)
    }
}
