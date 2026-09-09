package com.chillflixvibes.tv.data

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Local playback state — the Kotlin counterpart of `lib/storage.ts`, plus a
 * "Continue watching" list. On a TV this row matters more than on the web: it
 * is the shortest path from switching the telly on to being back in a show.
 */
@Serializable
data class WatchEntry(
    val id: Int,
    val type: String,
    val title: String,
    val posterPath: String? = null,
    val backdropPath: String? = null,
    val season: Int = 1,
    val episode: Int = 1,
    val updatedAt: Long = 0L,
) {
    val mediaType: MediaType get() = MediaType.fromSlug(type)

    fun toMediaItem() = MediaItem(
        id = id,
        title = title,
        posterPath = posterPath,
        backdropPath = backdropPath,
        mediaTypeRaw = type,
    )
}

class WatchStore(context: Context) {

    private val prefs = context.applicationContext.getSharedPreferences("watch", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    init {
        // Rather than migrate stored state whose shape has changed, drop it:
        // bump SCHEMA and the next launch starts clean. Version 3 is where the
        // player preference stopped being a position in the lineup and became a
        // provider id, which is why a reorder no longer needs one — a position
        // meant a different provider afterwards, a provider id does not.
        if (prefs.getInt(SCHEMA, 0) != SCHEMA_VERSION) {
            prefs.edit().clear().putInt(SCHEMA, SCHEMA_VERSION).apply()
        }
    }

    /** Season/episode the user last watched, defaulting to S1·E1. */
    fun lastWatched(type: MediaType, id: Int): Pair<Int, Int> =
        prefs.getInt(seasonKey(type, id), 1) to prefs.getInt(episodeKey(type, id), 1)

    fun setLastWatched(type: MediaType, id: Int, season: Int, episode: Int) {
        prefs.edit().putInt(seasonKey(type, id), season).putInt(episodeKey(type, id), episode).apply()
    }

    /** Whether the user has ever started this title (drives "Resume" vs "Play"). */
    fun hasProgress(type: MediaType, id: Int): Boolean = prefs.contains(seasonKey(type, id))

    /**
     * The player the user last picked, stored by provider id — `vidlink`,
     * `vidnest` and the rest of `Streams.kt` — rather than by position.
     *
     * Null is "no preference yet", and deliberately not a provider: the caller
     * reads an id it cannot find in the current lineup as that lineup's own
     * first player, so a null opens whichever provider leads the lineup in
     * front of it — vidlink normally, vidnest on an anime one. Naming vidlink
     * here instead would open anime on vidlink, since vidlink IS in the anime
     * lineup, one slot down. An old, numeric value reads as null the same way.
     */
    var preferredPlayer: String?
        get() = runCatching { prefs.getString(PREFERRED_SERVER, null) }.getOrNull()
        set(value) = prefs.edit().putString(PREFERRED_SERVER, value).apply()

    /**
     * Whether playback goes through the site's `/embed` page or loads the
     * provider directly. Old WebViews may fail on our page's scripts before the
     * iframe exists, so being able to bypass it on the device is worth a toggle.
     */
    var useProxy: Boolean
        get() = prefs.getBoolean(USE_PROXY, true)
        set(value) = prefs.edit().putBoolean(USE_PROXY, value).apply()

    fun continueWatching(): List<WatchEntry> =
        runCatching { json.decodeFromString<List<WatchEntry>>(prefs.getString(CONTINUE, "[]") ?: "[]") }
            .getOrDefault(emptyList())
            .sortedByDescending { it.updatedAt }

    /** Records a title as in-progress, moving it to the front of the row. */
    fun record(entry: WatchEntry) {
        val updated = (listOf(entry.copy(updatedAt = System.currentTimeMillis())) +
            continueWatching().filterNot { it.id == entry.id && it.type == entry.type })
            .take(MAX_CONTINUE)
        prefs.edit().putString(CONTINUE, json.encodeToString(updated)).apply()
    }



    private fun seasonKey(type: MediaType, id: Int) = "${type.slug}-$id-season"
    private fun episodeKey(type: MediaType, id: Int) = "${type.slug}-$id-episode"

    companion object {
        private const val SCHEMA = "schema"

        /** Bump to wipe locally stored playback state on the next launch. */
        const val SCHEMA_VERSION = 3

        private const val PREFERRED_SERVER = "preferred-player"
        private const val USE_PROXY = "use-proxy"
        private const val CONTINUE = "continue-watching"
        private const val MAX_CONTINUE = 20
    }
}
