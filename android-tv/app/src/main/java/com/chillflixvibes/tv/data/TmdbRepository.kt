package com.chillflixvibes.tv.data

import android.content.Context
import com.chillflixvibes.tv.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * Talks to the ChillFlixVibes deployment's own route handlers rather than to
 * TMDB directly: `/api/tmdb/<path>` proxies TMDB with the bearer token attached
 * server-side (see `app/api/tmdb/[...path]/route.ts`), so no API token ever
 * ships inside the APK — and the proxy's CDN caching benefits the TV app too.
 *
 * Responses are memoised for the process lifetime. Browsing on a remote means
 * a lot of back-and-forth between rows and detail screens, and re-fetching on
 * every Back press is what makes a TV app feel sluggish.
 */
class TmdbRepository(private val baseUrl: String) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    private val memo = object : LinkedHashMap<String, String>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, String>?) = size > 250
    }

    private suspend fun getBody(path: String, params: Map<String, String> = emptyMap()): String =
        withContext(Dispatchers.IO) {
            val url = (baseUrl.trimEnd('/') + path).toHttpUrl().newBuilder()
                .apply { params.forEach { (key, value) -> addQueryParameter(key, value) } }
                .build()
            val key = url.toString()

            synchronized(memo) { memo[key] }?.let { return@withContext it }

            client.newCall(Request.Builder().url(url).header("Accept", "application/json").build())
                .execute()
                .use { response ->
                    val body = response.body?.string().orEmpty()
                    if (!response.isSuccessful) {
                        error("HTTP ${response.code} for $key")
                    }
                    synchronized(memo) { memo[key] = body }
                    body
                }
        }

    private suspend fun tmdb(path: String, params: Map<String, String> = emptyMap()): String =
        getBody("/api/tmdb$path", params)

    /** Mixed movies + shows, each tagged with its own `media_type`. */
    suspend fun trending(window: String = "day", page: Int = 1): List<MediaItem> =
        json.decodeFromString<Paged<MediaItem>>(tmdb("/trending/all/$window", mapOf("page" to page.toString())))
            .results
            .filter { it.mediaTypeRaw == "movie" || it.mediaTypeRaw == "tv" }

    suspend fun discover(type: MediaType, filters: Map<String, String>, page: Int = 1): Paged<MediaItem> =
        json.decodeFromString(tmdb("/discover/${type.slug}", filters + ("page" to page.toString())))

    suspend fun search(type: MediaType, query: String, page: Int = 1): Paged<MediaItem> =
        json.decodeFromString(
            tmdb("/search/${type.slug}", mapOf("query" to query, "page" to page.toString(), "include_adult" to "false")),
        )

    suspend fun details(type: MediaType, id: Int): MediaDetails =
        json.decodeFromString(tmdb("/${type.slug}/$id", mapOf("append_to_response" to "credits")))

    suspend fun season(tvId: Int, seasonNumber: Int): SeasonDetails =
        json.decodeFromString(tmdb("/tv/$tvId/season/$seasonNumber"))

    suspend fun recommendations(type: MediaType, id: Int): List<MediaItem> =
        json.decodeFromString<Paged<MediaItem>>(tmdb("/${type.slug}/$id/recommendations")).results

    /**
     * TMDB id → AniList id, via the site's `/api/anime-id` handler. The anime
     * player is keyed by AniList id; null means "fall back to the TMDB players".
     */
    suspend fun anilistId(tmdbId: Int): Int? = runCatching {
        json.decodeFromString<AnimeIds>(getBody("/api/anime-id/$tmdbId")).anilistId
    }.getOrNull()

    companion object {
        @Volatile
        private var instance: TmdbRepository? = null

        /** Process-wide singleton so the response cache is shared by all screens. */
        fun get(context: Context): TmdbRepository =
            instance ?: synchronized(this) {
                instance ?: TmdbRepository(
                    context.applicationContext.getString(R.string.api_base_url),
                ).also { instance = it }
            }
    }
}
