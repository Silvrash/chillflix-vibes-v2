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

    /** Season/episode the user last watched, defaulting to S1·E1. */
    fun lastWatched(type: MediaType, id: Int): Pair<Int, Int> =
        prefs.getInt(seasonKey(type, id), 1) to prefs.getInt(episodeKey(type, id), 1)

    fun setLastWatched(type: MediaType, id: Int, season: Int, episode: Int) {
        prefs.edit().putInt(seasonKey(type, id), season).putInt(episodeKey(type, id), episode).apply()
    }

    /** Whether the user has ever started this title (drives "Resume" vs "Play"). */
    fun hasProgress(type: MediaType, id: Int): Boolean = prefs.contains(seasonKey(type, id))

    /**
     * Index of the player the user last picked. Stored globally — the
     * "Player 1 / 2" labels line up across lineups — and clamped by the caller
     * to the current lineup's length.
     */
    var preferredServer: Int
        get() = prefs.getInt(PREFERRED_SERVER, 0)
        set(value) = prefs.edit().putInt(PREFERRED_SERVER, value).apply()

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

    fun remove(type: MediaType, id: Int) {
        val updated = continueWatching().filterNot { it.id == id && it.type == type.slug }
        prefs.edit().putString(CONTINUE, json.encodeToString(updated)).apply()
    }

    private fun seasonKey(type: MediaType, id: Int) = "${type.slug}-$id-season"
    private fun episodeKey(type: MediaType, id: Int) = "${type.slug}-$id-episode"

    companion object {
        private const val PREFERRED_SERVER = "preferred-player"
        private const val CONTINUE = "continue-watching"
        private const val MAX_CONTINUE = 20
    }
}
