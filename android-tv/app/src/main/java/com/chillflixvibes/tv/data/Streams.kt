package com.chillflixvibes.tv.data

/**
 * The player lineup.
 *
 * Playback normally goes through the site's `/embed` route, which builds the
 * provider URL itself. The direct URLs below exist so the player can bypass
 * that and load a provider as the top-level document — useful on old devices,
 * where our own page's scripts may fail before the iframe ever gets a chance.
 *
 * Keep the order identical to `lib/streaming/vidsrc.ts`: the position is what
 * travels as `?server=N`, and the id as `?player=`.
 */
data class Player(
    val id: String,
    val label: String,
    val host: String,
    val movieUrl: (Int) -> String,
    val episodeUrl: (Int, Int, Int) -> String,
)

/**
 * Stable ids. A preference is stored by id rather than by position, so
 * reordering the lineup can't silently repoint someone at a different provider
 * — and anyone upgrading from the old numeric preference (where 0 and 1 meant
 * "Player 1"/"Player 2") simply lands on the main player.
 */
const val PLAYER_MAIN = "main"
const val PLAYER_ALTERNATE = "alternate"
const val PLAYER_BACKUP = "backup"

private const val LANGUAGE = "en"

// vidlink player options (see vidlink.pro docs): match the app accent, and show
// the poster/title chrome, which reads better at TV distance.
private const val VIDLINK_OPTIONS =
    "primaryColor=2563eb&secondaryColor=a2a2a2&iconColor=eefdec&icons=vid&title=true&poster=true&nextbutton=true"

private val VidSrcEmbed = Player(
    id = PLAYER_MAIN,
    label = "Main Player",
    host = "vidsrc-embed.ru",
    movieUrl = { id -> "https://vidsrc-embed.ru/embed/movie?tmdb=$id&ds_lang=$LANGUAGE" },
    episodeUrl = { id, s, e -> "https://vidsrc-embed.ru/embed/tv?tmdb=$id&season=$s&episode=$e&ds_lang=$LANGUAGE" },
)

private val VidLink = Player(
    id = PLAYER_ALTERNATE,
    label = "Alternate Player",
    host = "vidlink.pro",
    movieUrl = { id -> "https://vidlink.pro/movie/$id?$VIDLINK_OPTIONS" },
    episodeUrl = { id, s, e -> "https://vidlink.pro/tv/$id/$s/$e?$VIDLINK_OPTIONS" },
)

private val VidSrcTo = Player(
    id = PLAYER_BACKUP,
    label = "Backup Player",
    host = "vidsrc.to",
    movieUrl = { id -> "https://vidsrc.to/embed/movie/$id?ds_lang=$LANGUAGE" },
    episodeUrl = { id, s, e -> "https://vidsrc.to/embed/tv/$id/$s/$e?ds_lang=$LANGUAGE" },
)

/** vidnest's anime player, keyed by AniList id with an explicit sub track. */
private fun vidnestAnime(anilistId: Int) = Player(
    id = PLAYER_MAIN,
    label = "Main Player",
    host = "vidnest.fun",
    movieUrl = { "https://vidnest.fun/anime/$anilistId/1/sub" },
    episodeUrl = { _, _, e -> "https://vidnest.fun/anime/$anilistId/$e/sub" },
)

fun playersFor(type: MediaType, isAnime: Boolean, anilistId: Int?): List<Player> = when {
    // Anime leads with vidnest, then the TMDB-keyed players.
    isAnime && anilistId != null -> listOf(
        vidnestAnime(anilistId),
        VidSrcEmbed.copy(id = PLAYER_ALTERNATE, label = "Alternate Player"),
        VidLink.copy(id = PLAYER_BACKUP, label = "Backup Player"),
    )
    type == MediaType.TV -> listOf(VidSrcEmbed, VidLink, VidSrcTo)
    // Movies drop the least reliable provider.
    else -> listOf(VidSrcEmbed, VidLink)
}
