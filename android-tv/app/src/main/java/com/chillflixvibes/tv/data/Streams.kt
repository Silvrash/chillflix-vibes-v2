package com.chillflixvibes.tv.data

/**
 * The player lineup.
 *
 * Playback goes through the site's `/embed` route, which builds the provider
 * URL itself, so the app never constructs one — it only needs the ordered list
 * and which entry the user picked. Keep this order identical to
 * `lib/streaming/vidsrc.ts`, since the position is what travels as `?server=N`.
 */
data class Player(val id: String, val label: String)

/**
 * Stable ids. A preference is stored by id rather than by position, so
 * reordering the lineup can't silently repoint someone at a different provider
 * — and anyone upgrading from the old numeric preference (where 0 and 1 meant
 * "Player 1"/"Player 2") simply lands on the main player.
 */
const val PLAYER_MAIN = "main"
const val PLAYER_ALTERNATE = "alternate"
const val PLAYER_BACKUP = "backup"

private val Main = Player(PLAYER_MAIN, "Main Player")
private val Alternate = Player(PLAYER_ALTERNATE, "Alternate Player")
private val Backup = Player(PLAYER_BACKUP, "Backup Player")

fun playersFor(type: MediaType, isAnime: Boolean, anilistId: Int?): List<Player> = when {
    // Anime leads with vidnest, then the TMDB-keyed players.
    isAnime && anilistId != null -> listOf(Main, Alternate, Backup)
    type == MediaType.TV -> listOf(Main, Alternate, Backup)
    // Movies drop the least reliable provider.
    else -> listOf(Main, Alternate)
}
