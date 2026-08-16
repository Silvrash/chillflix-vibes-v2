package com.chillflixvibes.tv.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * TMDB response models — the Kotlin counterpart of `lib/tmdb/queries.ts`.
 *
 * Only the fields the TV UI actually renders are declared; the JSON parser is
 * configured to ignore everything else, so TMDB can keep adding fields without
 * breaking the app.
 */

enum class MediaType(val slug: String) {
    MOVIE("movie"),
    TV("tv");

    companion object {
        fun fromSlug(slug: String?): MediaType = if (slug == TV.slug) TV else MOVIE
    }
}

@Serializable
data class Paged<T>(
    val page: Int = 1,
    val results: List<T> = emptyList(),
    @SerialName("total_pages") val totalPages: Int = 1,
)

@Serializable
data class Genre(val id: Int, val name: String = "")

/** A row/grid entry: the shape TMDB returns from discover, search and trending. */
@Serializable
data class MediaItem(
    val id: Int,
    val title: String? = null,
    val name: String? = null,
    val overview: String = "",
    @SerialName("poster_path") val posterPath: String? = null,
    @SerialName("backdrop_path") val backdropPath: String? = null,
    @SerialName("vote_average") val voteAverage: Double = 0.0,
    val popularity: Double = 0.0,
    @SerialName("release_date") val releaseDate: String? = null,
    @SerialName("first_air_date") val firstAirDate: String? = null,
    @SerialName("media_type") val mediaTypeRaw: String? = null,
    @SerialName("genre_ids") val genreIds: List<Int> = emptyList(),
    @SerialName("original_language") val originalLanguage: String? = null,
) {
    val displayTitle: String get() = title ?: name ?: ""
    val year: String? get() = (releaseDate ?: firstAirDate)?.take(4)?.takeIf { it.length == 4 }

    /**
     * `/trending/all` tags each result with its own type; discover/search
     * responses don't, so the caller's list type is used as the fallback.
     */
    fun mediaType(fallback: MediaType): MediaType =
        mediaTypeRaw?.let { MediaType.fromSlug(it) } ?: fallback
}

@Serializable
data class CastMember(
    val id: Int,
    val name: String = "",
    val character: String = "",
    @SerialName("profile_path") val profilePath: String? = null,
)

@Serializable
data class Credits(val cast: List<CastMember> = emptyList())

@Serializable
data class Season(
    val id: Int = 0,
    val name: String = "",
    @SerialName("season_number") val seasonNumber: Int = 0,
    @SerialName("episode_count") val episodeCount: Int = 0,
    @SerialName("air_date") val airDate: String? = null,
)

@Serializable
data class Episode(
    val id: Int = 0,
    val name: String = "",
    val overview: String = "",
    @SerialName("episode_number") val episodeNumber: Int = 0,
    @SerialName("season_number") val seasonNumber: Int = 0,
    @SerialName("still_path") val stillPath: String? = null,
    @SerialName("air_date") val airDate: String? = null,
)

@Serializable
data class SeasonDetails(
    val id: Int = 0,
    val name: String = "",
    @SerialName("season_number") val seasonNumber: Int = 0,
    val episodes: List<Episode> = emptyList(),
)

@Serializable
data class MediaDetails(
    val id: Int = 0,
    val title: String? = null,
    val name: String? = null,
    val overview: String = "",
    val tagline: String = "",
    val status: String = "",
    @SerialName("poster_path") val posterPath: String? = null,
    @SerialName("backdrop_path") val backdropPath: String? = null,
    @SerialName("vote_average") val voteAverage: Double = 0.0,
    @SerialName("release_date") val releaseDate: String? = null,
    @SerialName("first_air_date") val firstAirDate: String? = null,
    @SerialName("original_language") val originalLanguage: String? = null,
    val runtime: Int? = null,
    @SerialName("episode_run_time") val episodeRunTime: List<Int> = emptyList(),
    @SerialName("number_of_seasons") val numberOfSeasons: Int = 0,
    @SerialName("in_production") val inProduction: Boolean = false,
    val genres: List<Genre> = emptyList(),
    val seasons: List<Season> = emptyList(),
    val credits: Credits? = null,
) {
    val displayTitle: String get() = title ?: name ?: ""
    val year: String? get() = (releaseDate ?: firstAirDate)?.take(4)?.takeIf { it.length == 4 }
    val runtimeMinutes: Int? get() = runtime ?: episodeRunTime.firstOrNull()

    /** Seasons excluding "Specials" (season 0), which the players don't carry. */
    val airedSeasons: List<Season> get() = seasons.filter { it.seasonNumber > 0 }

    /**
     * Japanese animation streams from a different provider (keyed by AniList
     * id), so it's detected the same way the web app does it.
     */
    val isAnime: Boolean
        get() = genres.any { it.id == 16 } && originalLanguage == "ja"
}

@Serializable
data class AnimeIds(
    @SerialName("anilistId") val anilistId: Int? = null,
    @SerialName("malId") val malId: Int? = null,
)

/** Builds a TMDB CDN image URL — the Kotlin twin of `getTMDBImageUrl`. */
object TmdbImage {
    private const val BASE = "https://image.tmdb.org/t/p/"

    const val POSTER = "w342"
    const val BACKDROP = "w1280"
    const val STILL = "w300"
    const val PROFILE = "w185"

    fun url(path: String?, size: String = POSTER): String? =
        path?.takeIf { it.isNotBlank() }?.let { BASE + size + it }
}
