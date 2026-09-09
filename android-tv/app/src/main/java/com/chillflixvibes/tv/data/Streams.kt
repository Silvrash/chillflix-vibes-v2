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
 * travels as the legacy `?server=N`, and the id as `?player=`.
 */
data class Player(
    val id: String,
    val label: String,
    val host: String,
    val movieUrl: (Int) -> String,
    val episodeUrl: (Int, Int, Int) -> String,
)

/**
 * Provider ids, not slot ids: each names one provider wherever it sits, so a
 * stored preference goes on meaning the same provider after a reorder, and an
 * anime lineup — which leads with vidnest where every other lineup leads with
 * vidlink — is distinguishable from one that leads with vidlink rather than
 * both reading as "the first one".
 *
 * The same strings are spelled out in `lib/streaming/vidsrc.ts` on the site and
 * in `Data/Catalogue.swift` in the Mac app. They travel between the three as
 * `?player=`, so they cannot drift apart.
 *
 * The labels stay slot-based: the viewer picks a position in the lineup, and
 * which provider sits there is not something to put on a button.
 */
const val PLAYER_VIDLINK = "vidlink"
const val PLAYER_VIDSRC_EMBED = "vidsrc-embed"
const val PLAYER_VIDSRC_TO = "vidsrc-to"
const val PLAYER_VIDNEST = "vidnest"

private const val LANGUAGE = "en"

// vidlink player options (see vidlink.pro docs): match the app accent, and show
// the poster/title chrome, which reads better at TV distance.
private const val VIDLINK_OPTIONS =
    "primaryColor=2563eb&secondaryColor=a2a2a2&iconColor=eefdec&icons=vid&title=true&poster=true&nextbutton=true"

private val VidSrcEmbed = Player(
    id = PLAYER_VIDSRC_EMBED,
    label = "Alternate Player",
    host = "vidsrc-embed.ru",
    movieUrl = { id -> "https://vidsrc-embed.ru/embed/movie?tmdb=$id&ds_lang=$LANGUAGE" },
    episodeUrl = { id, s, e -> "https://vidsrc-embed.ru/embed/tv?tmdb=$id&season=$s&episode=$e&ds_lang=$LANGUAGE" },
)

private val VidLink = Player(
    id = PLAYER_VIDLINK,
    label = "Main Player",
    host = "vidlink.pro",
    movieUrl = { id -> "https://vidlink.pro/movie/$id?$VIDLINK_OPTIONS" },
    episodeUrl = { id, s, e -> "https://vidlink.pro/tv/$id/$s/$e?$VIDLINK_OPTIONS" },
)

private val VidSrcTo = Player(
    id = PLAYER_VIDSRC_TO,
    label = "Backup Player",
    host = "vidsrc.to",
    movieUrl = { id -> "https://vidsrc.to/embed/movie/$id?ds_lang=$LANGUAGE" },
    episodeUrl = { id, s, e -> "https://vidsrc.to/embed/tv/$id/$s/$e?ds_lang=$LANGUAGE" },
)

/** vidnest's anime player, keyed by AniList id with an explicit sub track. */
private fun vidnestAnime(anilistId: Int) = Player(
    id = PLAYER_VIDNEST,
    label = "Main Player",
    host = "vidnest.fun",
    movieUrl = { "https://vidnest.fun/anime/$anilistId/1/sub" },
    episodeUrl = { _, _, e -> "https://vidnest.fun/anime/$anilistId/$e/sub" },
)

fun playersFor(type: MediaType, isAnime: Boolean, anilistId: Int?): List<Player> = when {
    // Anime leads with vidnest, then the TMDB-keyed players. The two below move
    // down a slot and are relabelled for it, but keep the ids they have
    // everywhere else: the label is the position, the id is the provider.
    isAnime && anilistId != null -> listOf(
        vidnestAnime(anilistId),
        VidLink.copy(label = "Alternate Player"),
        VidSrcEmbed.copy(label = "Backup Player"),
    )
    type == MediaType.TV -> listOf(VidLink, VidSrcEmbed, VidSrcTo)
    // Movies drop the least reliable provider.
    else -> listOf(VidLink, VidSrcEmbed)
}
