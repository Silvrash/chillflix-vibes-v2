package com.chillflixvibes.tv.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
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
import com.chillflixvibes.tv.ui.theme.Background
import com.chillflixvibes.tv.ui.theme.CardShape
import com.chillflixvibes.tv.ui.theme.ControlShape
import com.chillflixvibes.tv.ui.theme.Glass
import com.chillflixvibes.tv.ui.theme.GlassFocused
import com.chillflixvibes.tv.ui.theme.GlassRaised
import com.chillflixvibes.tv.ui.theme.Hairline
import com.chillflixvibes.tv.ui.theme.Muted
import com.chillflixvibes.tv.ui.theme.PillShape
import com.chillflixvibes.tv.ui.theme.Primary
import com.chillflixvibes.tv.ui.theme.StarAmber
import com.chillflixvibes.tv.ui.theme.Surface
import kotlinx.coroutines.delay

/** Overscan-safe screen margin: TVs crop the outer ~5% of the panel. */
val ScreenPadding = 48.dp

/** Poster width in a shelf — read from a couch, not held in a hand. */
private val PosterWidth = 158.dp

/**
 * Shared building blocks for the 10-foot UI.
 *
 * Focus is the whole game on a TV: there is no pointer, so the focused element
 * is the cursor. Everything focusable therefore grows a little and takes a blue
 * ring, which is the one piece of colour the chrome is allowed — the artwork
 * owns the rest. Compose moves focus for the arrow keys on its own once
 * elements are `clickable`/`focusable`, which is what makes this feel instant
 * compared with driving a cursor around the web build.
 */

/** Short enough to feel attached to the key press, long enough not to snap. */
private const val FOCUS_MS = 160

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

/** A translucent black plate under a hairline edge — the web's glass panels. */
fun Modifier.glass(shape: Shape, fill: Color = Glass): Modifier =
    clip(shape).background(fill).border(1.dp, Hairline, shape)

/**
 * The focus ring, held clear of the control it marks by a gap the control keeps
 * whether or not it is focused — so a row of buttons never shifts as the D-pad
 * travels along it.
 */
fun Modifier.focusRing(focused: Boolean, radius: Dp): Modifier {
    val gap = 4.dp
    val width = 3.dp
    return border(
        width = width,
        color = if (focused) Primary else Color.Transparent,
        shape = RoundedCornerShape(radius + gap + width),
    ).padding(gap + width)
}

@Composable
fun Loading(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Primary, strokeWidth = 3.dp)
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

/** A poster/backdrop image on a neutral plate while it loads. */
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
    Box(modifier.background(Surface)) {
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

/**
 * The scrims over a full-bleed hero: one from the left so the copy always has a
 * dark bed to sit on, one from the bottom so the artwork melts into the first
 * shelf. Emitted as siblings inside the hero's own Box.
 */
@Composable
fun HeroScrims() {
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
                0f to Background.copy(alpha = 0.55f),
                0.35f to Color.Transparent,
                0.72f to Background.copy(alpha = 0.78f),
                1f to Background,
            ),
        )
    )
}

/** The heading over a shelf. */
@Composable
fun SectionHeading(title: String, modifier: Modifier = Modifier) {
    Text(
        title,
        style = MaterialTheme.typography.titleLarge,
        color = Color.White,
        modifier = modifier.padding(start = ScreenPadding, bottom = 14.dp),
    )
}

/** "★ 8.4" on glass — the one number people actually scan for. */
@Composable
fun RatingBadge(rating: Double, modifier: Modifier = Modifier) {
    Row(
        modifier.glass(PillShape).padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Icon(Icons.Filled.Star, contentDescription = null, tint = StarAmber, modifier = Modifier.size(15.dp))
        Text(
            String.format("%.1f", rating),
            style = MaterialTheme.typography.labelMedium,
            color = Color.White,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

/** A non-interactive glass label, e.g. a genre on a detail page. */
@Composable
fun MetaPill(label: String, modifier: Modifier = Modifier) {
    Text(
        label,
        style = MaterialTheme.typography.labelMedium,
        color = Color.White,
        maxLines = 1,
        modifier = modifier
            .glass(ControlShape, fill = GlassRaised)
            .padding(horizontal = 14.dp, vertical = 7.dp),
    )
}

// ---------------------------------------------------------------- interactive

/**
 * A chip — browse presets, seasons, the player's server choices. Solid white
 * with black text when it is the one in force, glass when it isn't.
 */
@Composable
fun TvChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        if (focused) 1.04f else 1f,
        animationSpec = tween(FOCUS_MS),
        label = "chip-scale",
    )
    Box(
        modifier
            .then(focusRequester?.let { Modifier.focusRequester(it) } ?: Modifier)
            .scale(scale)
            .focusRing(focused, radius = 14.dp)
            .clip(ControlShape)
            .background(
                when {
                    selected -> Color.White
                    focused -> GlassFocused
                    else -> GlassRaised
                }
            )
            .border(1.dp, if (selected) Color.Transparent else Hairline, ControlShape)
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 11.dp),
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            color = when {
                selected -> Color.Black
                focused -> Color.White
                else -> Muted
            },
            maxLines = 1,
        )
    }
}

/**
 * Primary call-to-action, e.g. "Resume S2 · E4": solid white with black text,
 * the way the web draws the one action a page is for. [filled] `false` gives
 * the secondary form — glass, so it sits over artwork.
 */
@Composable
fun TvButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    filled: Boolean = true,
    icon: ImageVector? = null,
    focusRequester: FocusRequester? = null,
    onFocused: (() -> Unit)? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        if (focused) 1.04f else 1f,
        animationSpec = tween(FOCUS_MS),
        label = "button-scale",
    )
    val onSurface = if (filled) Color.Black else Color.White

    Row(
        modifier
            .scale(scale)
            .focusRing(focused, radius = 14.dp)
            .clip(ControlShape)
            .background(
                when {
                    filled -> Color.White
                    focused -> GlassFocused
                    else -> GlassRaised
                }
            )
            .border(1.dp, if (filled) Color.Transparent else Hairline, ControlShape)
            .then(focusRequester?.let { Modifier.focusRequester(it) } ?: Modifier)
            .onFocusChanged {
                focused = it.isFocused
                if (it.isFocused) onFocused?.invoke()
            }
            .clickable(onClick = onClick)
            .padding(horizontal = 26.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = onSurface, modifier = Modifier.size(22.dp))
        }
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            color = onSurface,
            maxLines = 1,
        )
    }
}

/**
 * A focusable poster: artwork, then the title and a muted meta line beneath it,
 * left-aligned — the web's card, at couch distance. [aspect] is width/height —
 * 2:3 for posters, 16:9 for episode stills.
 */
@Composable
fun FocusableCard(
    imageUrl: String?,
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    /** Drawn as a badge over the artwork when above zero. */
    rating: Double? = null,
    /** Fixed card width; pass null to fill the parent (e.g. a grid cell). */
    width: Dp? = PosterWidth,
    aspect: Float = 2f / 3f,
    focusRequester: FocusRequester? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        if (focused) 1.06f else 1f,
        animationSpec = tween(FOCUS_MS),
        label = "card-scale",
    )

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
                .border(if (focused) 3.dp else 1.dp, if (focused) Primary else Hairline, CardShape),
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
                    modifier = Modifier.align(Alignment.Center).padding(10.dp),
                )
            }
            if (rating != null && rating > 0) {
                RatingBadge(rating, Modifier.align(Alignment.TopEnd).padding(8.dp))
            }
        }
        Text(
            title,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Medium,
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 10.dp),
        )
        if (subtitle != null) {
            Text(
                subtitle,
                style = MaterialTheme.typography.labelMedium,
                color = Muted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
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

    Column(modifier.padding(bottom = 30.dp)) {
        SectionHeading(title)
        LazyRow(
            modifier = Modifier.fillMaxWidth().focusGroup(),
            contentPadding = PaddingValues(horizontal = ScreenPadding, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            items(items, key = { "${it.mediaTypeRaw ?: fallbackType.slug}-${it.id}" }) { item ->
                FocusableCard(
                    imageUrl = TmdbImage.url(item.posterPath),
                    title = item.displayTitle,
                    subtitle = listOfNotNull(
                        item.year,
                        if (item.mediaType(fallbackType) == MediaType.TV) "TV" else "Movie",
                    ).joinToString("  ·  "),
                    rating = item.voteAverage,
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
    val scale by animateFloatAsState(
        if (focused) 1.06f else 1f,
        animationSpec = tween(FOCUS_MS),
        label = "see-all-scale",
    )
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
                .scale(scale)
                .clip(CardShape)
                .background(GlassRaised)
                .border(if (focused) 3.dp else 1.dp, if (focused) Primary else Hairline, CardShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = if (focused) Color.White else Muted,
                modifier = Modifier.size(44.dp),
            )
        }
        Text(
            "See all",
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Medium,
            color = Color.White,
            maxLines = 1,
            modifier = Modifier.padding(top = 10.dp),
        )
        Text(
            "Browse the full list",
            style = MaterialTheme.typography.labelMedium,
            color = Muted,
            maxLines = 1,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

/**
 * Non-interactive stand-in for a row whose data is still in flight, holding
 * roughly the height of the real thing so shelves below it don't jump when it
 * arrives.
 */
@Composable
fun RowPlaceholder(modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().padding(bottom = 30.dp)) {
        Box(
            Modifier
                .padding(start = ScreenPadding, bottom = 14.dp)
                .size(width = 220.dp, height = 26.dp)
                .clip(ControlShape)
                .background(Surface),
        )
        Row(
            Modifier.fillMaxWidth().padding(horizontal = ScreenPadding, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            repeat(5) {
                Column(Modifier.width(PosterWidth)) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .aspectRatio(2f / 3f)
                            .clip(CardShape)
                            .background(Surface),
                    )
                    Box(
                        Modifier
                            .padding(top = 10.dp)
                            .fillMaxWidth(0.8f)
                            .height(16.dp)
                            .clip(ControlShape)
                            .background(Surface),
                    )
                }
            }
        }
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
