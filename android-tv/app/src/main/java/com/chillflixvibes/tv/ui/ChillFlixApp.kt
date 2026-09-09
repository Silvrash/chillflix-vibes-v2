package com.chillflixvibes.tv.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import android.net.Uri
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.chillflixvibes.tv.BuildConfig
import com.chillflixvibes.tv.data.MediaType
import com.chillflixvibes.tv.data.Section
import com.chillflixvibes.tv.data.sectionForPreset
import com.chillflixvibes.tv.ui.browse.BrowseScreen
import com.chillflixvibes.tv.ui.components.ScreenPadding
import com.chillflixvibes.tv.ui.components.focusRing
import com.chillflixvibes.tv.ui.components.glass
import com.chillflixvibes.tv.ui.detail.DetailScreen
import com.chillflixvibes.tv.ui.home.HomeScreen
import com.chillflixvibes.tv.ui.search.SearchScreen
import com.chillflixvibes.tv.ui.theme.Background
import com.chillflixvibes.tv.ui.theme.ControlShape
import com.chillflixvibes.tv.ui.theme.GlassFocused
import com.chillflixvibes.tv.ui.theme.GlassRaised
import com.chillflixvibes.tv.ui.theme.Muted
import com.chillflixvibes.tv.ui.theme.PanelShape
import com.chillflixvibes.tv.ui.theme.Primary
import com.chillflixvibes.tv.ui.theme.PrimaryDark

private const val ROUTE_HOME = "home"
private const val ROUTE_SEARCH = "search"
private const val ROUTE_BROWSE = "browse/{section}?preset={preset}"
private const val ROUTE_DETAIL = "detail/{type}/{id}"

/**
 * Vertical overscan margin. `ScreenPadding` is the horizontal 5%; on a 16:9
 * panel the same 5% off a shorter axis is a little over half that.
 */
private val TopSafeInset = 28.dp

/** Vertical space the floating nav bar occupies; screens inset their content by it. */
val NavBarHeight = TopSafeInset + 76.dp

/**
 * Top-level navigation.
 *
 * The nav bar floats *over* the content rather than taking a slice of the
 * screen: that hands the hero the full 16:9 panel, so a 16:9 backdrop renders
 * with no cropping at all. A soft scrim behind the bar keeps the labels legible
 * whether they sit over artwork or over a poster shelf.
 */
@Composable
fun ChillFlixApp() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val route = backStackEntry?.destination?.route
    val showNavBar = route == null || route == ROUTE_HOME || route == ROUTE_SEARCH || route == ROUTE_BROWSE

    val openDetail: (MediaType, Int) -> Unit = { type, id ->
        navController.navigate("detail/${type.slug}/$id")
    }

    // "See all" on a shelf opens that shelf as a full grid, in whichever
    // section owns it.
    val openShelf: (String) -> Unit = { presetName ->
        val section = sectionForPreset(presetName)
        navController.navigate("browse/${section.slug}?preset=${Uri.encode(presetName)}")
    }

    // The nav bar floats above the content rather than sitting in the same
    // column, and Compose's geometric focus search won't reliably cross that
    // gap — so the two directions are wired up explicitly. `contentFocus` is
    // attached to each screen's root focus group (which forwards focus to its
    // first focusable child) and `navFocus` to the bar itself.
    val contentFocus = remember { FocusRequester() }
    val navFocus = remember { FocusRequester() }

    Box(Modifier.fillMaxSize().background(Background)) {
        NavHost(
            navController = navController,
            startDestination = ROUTE_HOME,
            modifier = Modifier.fillMaxSize(),
        ) {
            composable(ROUTE_HOME) {
                HomeScreen(
                    onOpen = openDetail,
                    onSeeAll = openShelf,
                    contentFocus = contentFocus,
                    navFocus = navFocus,
                )
            }
            composable(ROUTE_SEARCH) {
                SearchScreen(
                    onOpen = openDetail,
                    topInset = NavBarHeight,
                    contentFocus = contentFocus,
                    navFocus = navFocus,
                )
            }
            composable(
                ROUTE_BROWSE,
                arguments = listOf(
                    navArgument("section") { type = NavType.StringType },
                    navArgument("preset") {
                        type = NavType.StringType
                        defaultValue = ""
                    },
                ),
            ) { entry ->
                BrowseScreen(
                    section = Section.fromSlug(entry.arguments?.getString("section")),
                    initialPreset = entry.arguments?.getString("preset")?.takeIf { it.isNotBlank() },
                    onOpen = openDetail,
                    topInset = NavBarHeight,
                    contentFocus = contentFocus,
                    navFocus = navFocus,
                )
            }
            composable(
                ROUTE_DETAIL,
                arguments = listOf(
                    navArgument("type") { type = NavType.StringType },
                    navArgument("id") { type = NavType.IntType },
                ),
            ) { entry ->
                DetailScreen(
                    type = MediaType.fromSlug(entry.arguments?.getString("type")),
                    id = entry.arguments?.getInt("id") ?: 0,
                    onOpen = openDetail,
                )
            }
        }

        if (showNavBar) {
            NavBar(
                currentRoute = route,
                currentSection = backStackEntry?.arguments?.getString("section"),
                onNavigate = { destination -> navController.navigateTopLevel(destination) },
                navFocus = navFocus,
                contentFocus = contentFocus,
                modifier = Modifier.align(Alignment.TopStart),
            )
        }
    }
}

/**
 * Switching between top-level destinations replaces the current one rather
 * than stacking, so Back from anywhere in the nav bar goes Home once and then
 * exits — not back through every section the user browsed.
 */
private fun NavHostController.navigateTopLevel(destination: String) {
    navigate(destination) {
        popUpTo(ROUTE_HOME) { inclusive = destination == ROUTE_HOME }
        launchSingleTop = true
    }
}

/**
 * The floating glass pill the web app wears, centred over the artwork.
 *
 * A gradient behind it fades the top of the backdrop out: Compose has no
 * portable backdrop blur, so the pill's own translucency needs help holding the
 * labels legible over a bright hero.
 */
@Composable
private fun NavBar(
    currentRoute: String?,
    currentSection: String?,
    onNavigate: (String) -> Unit,
    navFocus: FocusRequester,
    contentFocus: FocusRequester,
    modifier: Modifier = Modifier,
) {
    Box(modifier.fillMaxWidth()) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(NavBarHeight + 48.dp)
                .background(
                    Brush.verticalGradient(
                        0f to Background.copy(alpha = 0.92f),
                        0.55f to Background.copy(alpha = 0.55f),
                        1f to Color.Transparent,
                    ),
                ),
        )

        Row(
            Modifier
                .align(Alignment.TopCenter)
                .padding(top = TopSafeInset)
                // Pressing Down hands focus straight to the screen's primary
                // control. Compose's geometric search doesn't cross from this
                // floating bar into the content below it, and a `focusProperties`
                // target only works when it names a genuinely focusable node —
                // which the content's root group is not.
                .onPreviewKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionDown) {
                        runCatching { contentFocus.requestFocus() }.isSuccess
                    } else {
                        false
                    }
                }
                .focusGroup()
                .glass(PanelShape)
                .padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Wordmark(Modifier.padding(start = 4.dp, end = 18.dp))
            NavItem("Home", currentRoute == ROUTE_HOME, focusRequester = navFocus) { onNavigate(ROUTE_HOME) }
            Section.entries.forEach { section ->
                NavItem(
                    label = section.label,
                    selected = currentRoute == ROUTE_BROWSE && currentSection == section.slug,
                    onClick = { onNavigate("browse/${section.slug}") },
                )
            }
            NavItem("Search", currentRoute == ROUTE_SEARCH) { onNavigate(ROUTE_SEARCH) }
        }

        // Sideloaded builds all look alike from the couch; showing the version
        // is the only way to tell what actually installed. It sits outside the
        // pill, which holds destinations only.
        Box(
            Modifier
                .align(Alignment.TopEnd)
                .padding(top = TopSafeInset, end = ScreenPadding)
                .height(NavBarHeight - TopSafeInset),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "v${BuildConfig.VERSION_NAME}",
                style = MaterialTheme.typography.labelSmall,
                color = Muted.copy(alpha = 0.7f),
            )
        }
    }
}

@Composable
private fun Wordmark(modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(34.dp).clip(RoundedCornerShape(11.dp)).background(PrimaryDark),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.PlayArrow,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(21.dp),
            )
        }
        Text(
            "CHILLFLIX",
            style = MaterialTheme.typography.titleMedium,
            color = Color.White,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.5.sp,
            modifier = Modifier.padding(start = 10.dp),
        )
    }
}

/**
 * A nav destination: neutral until it is the section you're in, and ringed in
 * blue when the D-pad is on it — the same focus mark every control in the app
 * wears, so there is never a question of where the remote is pointing.
 */
@Composable
private fun NavItem(
    label: String,
    selected: Boolean,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
) {
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        if (focused) 1.04f else 1f,
        animationSpec = tween(160),
        label = "nav-scale",
    )

    Box(
        Modifier
            .then(focusRequester?.let { Modifier.focusRequester(it) } ?: Modifier)
            .scale(scale)
            .focusRing(focused, radius = 14.dp)
            .clip(ControlShape)
            .background(
                when {
                    focused -> GlassFocused
                    selected -> GlassRaised
                    else -> Color.Transparent
                }
            )
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 8.dp),
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            color = if (focused || selected) Color.White else Muted,
            maxLines = 1,
        )
    }
}

/**
 * Increments every time the hosting activity resumes. Screens use it as a
 * `remember` key to re-read local playback state after the player closes.
 */
@Composable
fun rememberResumeTick(): Int {
    val lifecycleOwner = LocalLifecycleOwner.current
    var tick by remember { mutableIntStateOf(0) }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) tick++
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    return tick
}
