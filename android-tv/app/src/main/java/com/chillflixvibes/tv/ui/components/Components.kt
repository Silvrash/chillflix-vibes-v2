package com.chillflixvibes.tv.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.chillflixvibes.tv.data.MediaItem
import com.chillflixvibes.tv.data.MediaType
import com.chillflixvibes.tv.data.TmdbImage
import com.chillflixvibes.tv.ui.theme.Muted
import com.chillflixvibes.tv.ui.theme.Primary
import com.chillflixvibes.tv.ui.theme.PrimaryDark
import com.chillflixvibes.tv.ui.theme.Star
import com.chillflixvibes.tv.ui.theme.Surface
import com.chillflixvibes.tv.ui.theme.SurfaceLight
import kotlinx.coroutines.delay

/** Overscan-safe screen margin: TVs crop the outer ~5% of the panel. */
val ScreenPadding = 48.dp

private val PosterWidth = 156.dp
private val CardShape = RoundedCornerShape(10.dp)

/**
 * Shared building blocks for the 10-foot UI.
 *
 * Focus is the whole game on a TV: every interactive element grows, brightens
 * and draws a thick ring when the D-pad lands on it, so it's obvious from the
 * couch where you are. Compose moves focus for the arrow keys on its own once
 * elements are `clickable`/`focusable`, which is what makes this feel instant
 * compared with driving a cursor around the web build.
 */

// ---------------------------------------------------------------- async state

sealed interface LoadState<out T> {
    data object Loading : LoadState<Nothing>
    data class Success<T>(val value: T) : LoadState<T>
    data class Failed(val error: Throwable) : LoadState<Nothing>
}

/** Runs [loader] whenever [keys] change and exposes it as Compose state. */
@Composable
fun <T> rememberLoad(vararg keys: Any?, loader: suspend () -> T): LoadState<T> {
    val state = produceState<LoadState<T>>(LoadState.Loading, keys = keys) {
        value = LoadState.Loading
        value = runCatching { loader() }.fold({ LoadState.Success(it) }, { LoadState.Failed(it) })
    }
    return state.value
}

// ------------------------------------------------------------------- surfaces

@Composable
fun Loading(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Primary)
    }
}

@Composable
fun ErrorState(message: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize().padding(ScreenPadding), contentAlignment = Alignment.Center) {
        Text(
            message,
            style = MaterialTheme.typography.bodyLarge,
            color = Muted,
            textAlign = TextAlign.Center,
        )
    }
}

/** A poster/backdrop image with a coloured placeholder while it loads. */
@Composable
fun TvImage(
    url: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    /**
     * Which part of the image survives the crop. Backdrops are 16:9 but the
     * hero slot is much wider than that, so something has to go — anchoring to
     * the top keeps faces in frame instead of cropping heads off.
     */
    alignment: Alignment = Alignment.Center,
) {
    Box(modifier.background(SurfaceLight)) {
        if (url != null) {
            AsyncImage(
                model = url,
                contentDescription = contentDescription,
                contentScale = contentScale,
                alignment = alignment,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

// ---------------------------------------------------------------- interactive

/** Pill button used for nav, presets, seasons and player choices. */
@Composable
fun TvChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(24.dp)
    Box(
        modifier
            .then(focusRequester?.let { Modifier.focusRequester(it) } ?: Modifier)
            .clip(shape)
            .background(
                when {
                    focused -> Primary
                    selected -> PrimaryDark
                    else -> Surface
                }
            )
            .border(3.dp, if (focused) Color.White else Color.Transparent, shape)
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 10.dp),
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            color = if (focused || selected) Color.White else Muted,
            maxLines = 1,
        )
    }
}

/** Primary call-to-action, e.g. "Resume S2 · E4". */
@Composable
fun TvButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    filled: Boolean = true,
    focusRequester: FocusRequester? = null,
    onFocused: (() -> Unit)? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier
            .clip(shape)
            .background(
                when {
                    focused -> Color.White
                    filled -> PrimaryDark
                    else -> Surface
                }
            )
            .border(3.dp, if (focused) Primary else Color.Transparent, shape)
            .then(focusRequester?.let { Modifier.focusRequester(it) } ?: Modifier)
            .onFocusChanged {
                focused = it.isFocused
                if (it.isFocused) onFocused?.invoke()
            }
            .clickable(onClick = onClick)
            .padding(horizontal = 26.dp, vertical = 13.dp),
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            color = if (focused) Color(0xFF0A0E17) else Color.White,
            maxLines = 1,
        )
    }
}

/**
 * A focusable poster. [aspect] is width/height — 2:3 for posters, 16:9 for
 * episode stills.
 */
@Composable
fun FocusableCard(
    imageUrl: String?,
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    /** Fixed card width; pass null to fill the parent (e.g. a grid cell). */
    width: Dp? = PosterWidth,
    aspect: Float = 2f / 3f,
    focusRequester: FocusRequester? = null,
    overlay: @Composable BoxScope.() -> Unit = {},
) {
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (focused) 1.07f else 1f, label = "card-scale")

    // The whole card — artwork *and* label — is the focusable unit. Compose
    // scrolls the focused node into view, so if only the image were focusable
    // the title would be left hanging off the bottom of the screen. The
    // trailing padding is part of that node too, which keeps the label clear of
    // the panel edge (TVs crop the outer few percent).
    Column(
        modifier
            .then(if (width != null) Modifier.width(width) else Modifier.fillMaxWidth())
            .then(focusRequester?.let { Modifier.focusRequester(it) } ?: Modifier)
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(bottom = 14.dp),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(aspect)
                .scale(scale)
                .clip(CardShape)
                .border(3.dp, if (focused) Primary else Color.Transparent, CardShape),
        ) {
            TvImage(imageUrl, title, Modifier.fillMaxSize())
            if (imageUrl == null) {
                Text(
                    title,
                    style = MaterialTheme.typography.labelMedium,
                    color = Muted,
                    textAlign = TextAlign.Center,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.align(Alignment.Center).padding(8.dp),
                )
            }
            overlay()
        }
        Text(
            title,
            style = MaterialTheme.typography.labelMedium,
            color = if (focused) Color.White else Muted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 8.dp),
        )
        if (subtitle != null) {
            Text(
                subtitle,
                style = MaterialTheme.typography.labelMedium,
                color = Muted.copy(alpha = 0.75f),
                maxLines = 1,
            )
        }
    }
}

/** A horizontally-scrolling shelf of posters with a heading. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MediaRow(
    title: String,
    items: List<MediaItem>,
    fallbackType: MediaType,
    onSelect: (MediaItem, MediaType) -> Unit,
    modifier: Modifier = Modifier,
    firstItemFocusRequester: FocusRequester? = null,
    /** When set, the shelf ends in a tile that opens the full category. */
    onSeeAll: (() -> Unit)? = null,
) {
    if (items.isEmpty()) return

    Column(modifier.padding(bottom = 18.dp)) {
        Text(
            title,
            style = MaterialTheme.typography.titleLarge,
            color = Color.White,
            modifier = Modifier.padding(start = ScreenPadding, bottom = 10.dp),
        )
        LazyRow(
            modifier = Modifier.fillMaxWidth().focusGroup(),
            contentPadding = PaddingValues(horizontal = ScreenPadding, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            items(items, key = { "${it.mediaTypeRaw ?: fallbackType.slug}-${it.id}" }) { item ->
                FocusableCard(
                    imageUrl = TmdbImage.url(item.posterPath),
                    title = item.displayTitle,
                    subtitle = item.year,
                    onClick = { onSelect(item, item.mediaType(fallbackType)) },
                    focusRequester = firstItemFocusRequester.takeIf { items.firstOrNull()?.id == item.id },
                )
            }
            if (onSeeAll != null) {
                item(key = "see-all") { SeeAllCard(onClick = onSeeAll) }
            }
        }
    }
}

/**
 * Closes a shelf with a way into the full category — the TV convention, since
 * holding Right to the end of a row is how you discover there is more.
 */
@Composable
private fun SeeAllCard(onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Column(
        Modifier
            .width(PosterWidth)
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(bottom = 14.dp),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .clip(CardShape)
                .background(if (focused) Primary else Surface)
                .border(3.dp, if (focused) Color.White else Color.Transparent, CardShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "See all  \u203A",
                style = MaterialTheme.typography.titleMedium,
                color = if (focused) Color.White else Muted,
            )
        }
        Text(
            "Browse the full list",
            style = MaterialTheme.typography.labelMedium,
            color = if (focused) Color.White else Muted,
            maxLines = 1,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}


/** Non-interactive placeholder used while a row's data is still in flight. */
@Composable
fun RowPlaceholder(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(PosterWidth * 1.5f).padding(ScreenPadding)) {
        CircularProgressIndicator(color = Primary, modifier = Modifier.align(Alignment.CenterStart).size(28.dp))
    }
}

/**
 * Requests focus as soon as the target node is attached.
 *
 * A plain `requestFocus()` throws if the composable it belongs to hasn't been
 * laid out yet, which is exactly the case when a screen wants to focus
 * something that depends on data still in flight — so retry for a few frames.
 */
suspend fun FocusRequester.requestFocusWhenReady(attempts: Int = 30) {
    repeat(attempts) {
        if (runCatching { requestFocus() }.isSuccess) return
        delay(50)
    }
}

