package com.chillflixvibes.tv.data

/**
 * Embed-URL builders for the streaming providers — a port of
 * `lib/streaming/vidsrc.ts`. Playback is an embed page, so the app only needs
 * the URL; PlayerActivity loads it in a full-screen WebView.
 */
interface StreamServer {
    val name: String

    /** Host the embed lives on; PlayerActivity keeps navigation inside it. */
    val host: String

    fun movieUrl(tmdbId: Int): String
    fun episodeUrl(tmdbId: Int, season: Int, episode: Int): String
}

private const val LANGUAGE = "en"

// vidlink player options (see vidlink.pro docs): match the app accent, and show
// the poster/title chrome, which reads better at TV distance.
private const val VIDLINK_OPTIONS =
    "primaryColor=2563eb&secondaryColor=a2a2a2&iconColor=eefdec&icons=vid&title=true&poster=true&nextbutton=true"

object VidLink : StreamServer {
    override val name = "Player 1"
    override val host = "vidlink.pro"
    override fun movieUrl(tmdbId: Int) = "https://$host/movie/$tmdbId?$VIDLINK_OPTIONS"
    override fun episodeUrl(tmdbId: Int, season: Int, episode: Int) =
        "https://$host/tv/$tmdbId/$season/$episode?$VIDLINK_OPTIONS"
}

object VidSrcMe : StreamServer {
    override val name = "Player 2"
    override val host = "vidsrc-embed.ru"
    override fun movieUrl(tmdbId: Int) = "https://$host/embed/movie?tmdb=$tmdbId&ds_lang=$LANGUAGE"
    override fun episodeUrl(tmdbId: Int, season: Int, episode: Int) =
        "https://$host/embed/tv?tmdb=$tmdbId&season=$season&episode=$episode&ds_lang=$LANGUAGE"
}

object VidSrcTo : StreamServer {
    override val name = "Player 3"
    override val host = "vidsrc.to"
    override fun movieUrl(tmdbId: Int) = "https://$host/embed/movie/$tmdbId?ds_lang=$LANGUAGE"
    override fun episodeUrl(tmdbId: Int, season: Int, episode: Int) =
        "https://$host/embed/tv/$tmdbId/$season/$episode?ds_lang=$LANGUAGE"
}

/**
 * vidnest's anime player, keyed by AniList id with an explicit sub track. It
 * carries subbed sources the TMDB-based players often lack.
 */
private class VidnestAnime(private val anilistId: Int, override val name: String) : StreamServer {
    override val host = "vidnest.fun"
    override fun movieUrl(tmdbId: Int) = "https://$host/anime/$anilistId/1/sub"
    override fun episodeUrl(tmdbId: Int, season: Int, episode: Int) =
        "https://$host/anime/$anilistId/$episode/sub"
}

/** Renames a server so the lineup always reads "Player 1, 2, 3…". */
private class Renamed(private val delegate: StreamServer, override val name: String) : StreamServer by delegate

/**
 * The player lineup for a title, matching the web app's ordering:
 * anime leads with vidnest, movies use the two most reliable players, and
 * other TV gets the full list.
 */
fun serversFor(type: MediaType, isAnime: Boolean, anilistId: Int?): List<StreamServer> = when {
    isAnime && anilistId != null -> listOf(
        VidnestAnime(anilistId, "Player 1"),
        Renamed(VidLink, "Player 2"),
        Renamed(VidSrcMe, "Player 3"),
    )
    type == MediaType.TV -> listOf(VidLink, VidSrcMe, VidSrcTo)
    else -> listOf(VidLink, VidSrcMe)
}
