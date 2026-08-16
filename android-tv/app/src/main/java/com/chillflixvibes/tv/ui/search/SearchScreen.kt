package com.chillflixvibes.tv.ui.search

import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.chillflixvibes.tv.data.MediaItem
import com.chillflixvibes.tv.data.MediaType
import com.chillflixvibes.tv.data.TmdbImage
import com.chillflixvibes.tv.data.TmdbRepository
import com.chillflixvibes.tv.ui.components.FocusableCard
import com.chillflixvibes.tv.ui.components.Loading
import com.chillflixvibes.tv.ui.components.ScreenPadding
import com.chillflixvibes.tv.ui.components.requestFocusWhenReady
import com.chillflixvibes.tv.ui.theme.Background
import com.chillflixvibes.tv.ui.theme.Muted
import com.chillflixvibes.tv.ui.theme.Primary
import com.chillflixvibes.tv.ui.theme.Surface
import kotlinx.coroutines.delay

/**
 * Search across movies and shows at once. Typing is the one place a TV remote
 * genuinely struggles, so results stream in as you type (debounced) — usually
 * three or four characters is enough to stop typing and start navigating.
 */
@Composable
fun SearchScreen(
    onOpen: (MediaType, Int) -> Unit,
    modifier: Modifier = Modifier,
    /** Space kept clear at the top for the floating nav bar. */
    topInset: Dp = 0.dp,
    /** Attached to the query field so the nav bar can send focus down into it. */
    contentFocus: FocusRequester = remember { FocusRequester() },
    /** Where Up from the query field should land. */
    navFocus: FocusRequester? = null,
) {
    val context = LocalContext.current
    val repo = remember { TmdbRepository.get(context) }
    val focusManager = LocalFocusManager.current
    val fieldFocus = contentFocus

    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<Pair<MediaItem, MediaType>>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { fieldFocus.requestFocusWhenReady() }

    LaunchedEffect(query) {
        val trimmed = query.trim()
        if (trimmed.length < 2) {
            results = emptyList()
            loading = false
            return@LaunchedEffect
        }
        delay(400) // debounce: cancelled by the next keystroke
        loading = true
        val movies = runCatching { repo.search(MediaType.MOVIE, trimmed).results }.getOrDefault(emptyList())
        val shows = runCatching { repo.search(MediaType.TV, trimmed).results }.getOrDefault(emptyList())
        // Merge both result sets into one grid, most popular first, and drop
        // entries with no artwork — a poster wall of grey boxes is useless.
        results = (movies.map { it to MediaType.MOVIE } + shows.map { it to MediaType.TV })
            .filter { (item, _) -> item.posterPath != null }
            .sortedByDescending { (item, _) -> item.popularity }
        loading = false
    }

    Column(modifier.fillMaxSize().background(Background).padding(top = topInset)) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            singleLine = true,
            label = { Text("Search movies & shows") },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            // Pressing the IME's search key drops focus into the results grid.
            keyboardActions = KeyboardActions(onSearch = { focusManager.moveFocus(FocusDirection.Down) }),
            textStyle = MaterialTheme.typography.bodyLarge,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Primary,
                unfocusedBorderColor = Muted,
                focusedContainerColor = Surface,
                unfocusedContainerColor = Surface,
            ),
            modifier = Modifier
                .padding(horizontal = ScreenPadding, vertical = 12.dp)
                .fillMaxWidth(0.6f)
                .then(navFocus?.let { Modifier.focusProperties { up = it } } ?: Modifier)
                .focusRequester(fieldFocus),
        )

        when {
            loading && results.isEmpty() -> Loading()
            query.trim().length < 2 -> Hint("Type at least two letters to search.")
            results.isEmpty() -> Hint("No results for \"${query.trim()}\".")
            else -> LazyVerticalGrid(
                columns = GridCells.Adaptive(160.dp),
                modifier = Modifier.fillMaxSize().focusGroup(),
                contentPadding = PaddingValues(start = ScreenPadding, end = ScreenPadding, top = 8.dp, bottom = 32.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                items(results, key = { (item, type) -> "${type.slug}-${item.id}" }) { (item, type) ->
                    FocusableCard(
                        imageUrl = TmdbImage.url(item.posterPath),
                        title = item.displayTitle,
                        subtitle = listOfNotNull(item.year, if (type == MediaType.TV) "TV" else null).joinToString(" · "),
                        width = null,
                        onClick = { onOpen(type, item.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun Hint(message: String) {
    Box(Modifier.fillMaxSize().padding(ScreenPadding), contentAlignment = Alignment.Center) {
        Text(message, style = MaterialTheme.typography.bodyLarge, color = Muted)
    }
}
