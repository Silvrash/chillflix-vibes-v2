package com.chillflixvibes.tv.data

import java.util.Calendar

/**
 * Curated discover filters — a port of `lib/presets.ts` so the TV app browses
 * exactly the same shelves as the web app. Filter keys are passed straight
 * through to TMDB's `/discover` endpoint.
 */
data class Preset(val name: String, val type: MediaType, val filters: Map<String, String>)

private val currentYear: Int = Calendar.getInstance().get(Calendar.YEAR)

/** Japanese animation, the same way the web app defines it. */
val ANIME_FILTERS = mapOf(
    "with_genres" to "16",
    "with_original_language" to "ja",
)

val MOVIE_PRESETS: List<Preset> = listOf(
    Preset(
        "Recommended Movies", MediaType.MOVIE, mapOf(
            "sort_by" to "popularity.desc",
            "vote_average.gte" to "7.5",
            "vote_count.gte" to "250",
            "popularity.lte" to "500",
            "primary_release_date.gte" to "${currentYear - 5}-01-01",
        )
    ),
    Preset(
        "Popular New Releases", MediaType.MOVIE, mapOf(
            "sort_by" to "popularity.desc",
            "primary_release_date.gte" to "$currentYear-01-01",
            "vote_count.gte" to "500",
        )
    ),
    Preset(
        "Top Rated Classics", MediaType.MOVIE, mapOf(
            "sort_by" to "vote_average.desc",
            "primary_release_date.lte" to "${currentYear - 23}-12-31",
            "vote_count.gte" to "1000",
        )
    ),
    Preset(
        "Action-Packed Thrillers", MediaType.MOVIE, mapOf(
            "with_genres" to "28,53",
            "sort_by" to "popularity.desc",
            "vote_count.gte" to "200",
        )
    ),
    Preset(
        "Epic Sci-Fi Adventures", MediaType.MOVIE, mapOf(
            "with_genres" to "878",
            "sort_by" to "popularity.desc",
            "vote_count.gte" to "300",
        )
    ),
    Preset(
        "Animated Blockbusters", MediaType.MOVIE, mapOf(
            "with_genres" to "16",
            "sort_by" to "revenue.desc",
        )
    ),
    Preset(
        "Family-Friendly Movies", MediaType.MOVIE, mapOf(
            "with_genres" to "10751",
            "certification_country" to "US",
            "certification.lte" to "PG",
            "sort_by" to "popularity.desc",
        )
    ),
    Preset(
        "Romantic Comedies", MediaType.MOVIE, mapOf(
            "with_genres" to "10749,35",
            "sort_by" to "release_date.desc",
        )
    ),
    Preset(
        "Horror Movies for the Brave", MediaType.MOVIE, mapOf(
            "with_genres" to "27",
            "vote_average.gte" to "6.0",
            "sort_by" to "vote_count.desc",
        )
    ),
    Preset(
        "Korean Movies", MediaType.MOVIE, mapOf(
            "with_original_language" to "ko",
            "region" to "KR",
            "sort_by" to "popularity.desc",
            "vote_average.gte" to "6",
        )
    ),
    Preset(
        "Hindi Movies", MediaType.MOVIE, mapOf(
            "with_original_language" to "hi",
            "region" to "IN",
            "sort_by" to "popularity.desc",
            "vote_average.gte" to "5",
        )
    ),
    Preset(
        "Critically Acclaimed Documentaries", MediaType.MOVIE, mapOf(
            "with_genres" to "99",
            "sort_by" to "vote_average.desc",
            "vote_count.gte" to "200",
        )
    ),
    Preset(
        "Underrated Hidden Gems", MediaType.MOVIE, mapOf(
            "sort_by" to "vote_average.desc",
            "vote_count.lte" to "100",
            "primary_release_date.gte" to "${currentYear - 13}-01-01",
        )
    ),
)

val TV_PRESETS: List<Preset> = listOf(
    Preset(
        "Recommended TV Shows", MediaType.TV, mapOf(
            "sort_by" to "popularity.desc",
            "vote_average.gte" to "7.5",
            "vote_count.gte" to "100",
            "popularity.lte" to "500",
            "first_air_date.gte" to "${currentYear - 5}-01-01",
        )
    ),
    Preset(
        "Trending TV Shows", MediaType.TV, mapOf(
            "sort_by" to "popularity.desc",
            "first_air_date.lte" to "$currentYear-01-01",
            "vote_count.gte" to "500",
        )
    ),
    Preset(
        "Thrilling Action Shows", MediaType.TV, mapOf(
            "with_genres" to "10759,80",
            "sort_by" to "popularity.desc",
            "vote_count.gte" to "200",
        )
    ),
    Preset(
        "Epic Sci-Fi TV Shows", MediaType.TV, mapOf(
            "with_genres" to "10765",
            "sort_by" to "popularity.desc",
            "vote_count.gte" to "300",
        )
    ),
    Preset(
        "Classic TV Hits", MediaType.TV, mapOf(
            "sort_by" to "vote_average.desc",
            "first_air_date.lte" to "${currentYear - 23}-12-31",
            "vote_count.gte" to "100",
        )
    ),
    Preset(
        "Family TV Shows", MediaType.TV, mapOf(
            "with_genres" to "10751",
            "certification_country" to "US",
            "certification.lte" to "PG",
            "sort_by" to "popularity.desc",
        )
    ),
    Preset(
        "Chilling Horror Shows", MediaType.TV, mapOf(
            "with_genres" to "9648,80",
            "vote_average.gte" to "6.0",
            "sort_by" to "vote_count.desc",
        )
    ),
    Preset(
        "Romantic Comedies on TV", MediaType.TV, mapOf(
            "with_genres" to "10749,35",
            "sort_by" to "first_air_date.desc",
        )
    ),
    Preset(
        "Korean TV Shows", MediaType.TV, mapOf(
            "with_original_language" to "ko",
            "region" to "KR",
            "sort_by" to "popularity.desc",
        )
    ),
    Preset(
        "Insightful Documentary Series", MediaType.TV, mapOf(
            "with_genres" to "99",
            "sort_by" to "vote_average.desc",
            "vote_count.gte" to "200",
        )
    ),
    Preset(
        "Hidden Gem Series", MediaType.TV, mapOf(
            "sort_by" to "vote_average.desc",
            "vote_count.lte" to "100",
            "first_air_date.gte" to "${currentYear - 13}-01-01",
        )
    ),
)

val ANIME_PRESETS: List<Preset> = listOf(
    Preset(
        "Popular Anime", MediaType.TV, ANIME_FILTERS + mapOf(
            "sort_by" to "popularity.desc",
            "vote_count.gte" to "50",
        )
    ),
    Preset(
        "Top Rated Anime", MediaType.TV, ANIME_FILTERS + mapOf(
            "sort_by" to "vote_average.desc",
            "vote_count.gte" to "200",
        )
    ),
    Preset(
        "New Anime Seasons", MediaType.TV, ANIME_FILTERS + mapOf(
            "sort_by" to "first_air_date.desc",
            "vote_count.gte" to "20",
            "first_air_date.lte" to "$currentYear-12-31",
        )
    ),
    Preset(
        "Action Anime", MediaType.TV, ANIME_FILTERS + mapOf(
            "with_genres" to "16,10759",
            "sort_by" to "popularity.desc",
            "vote_count.gte" to "50",
        )
    ),
    Preset(
        "Anime Films", MediaType.MOVIE, ANIME_FILTERS + mapOf(
            "sort_by" to "popularity.desc",
            "vote_count.gte" to "100",
        )
    ),
)

/**
 * Every shelf, round-robined across movies / TV / anime so the home screen
 * stays varied all the way down. Rows are composed (and fetched) only as they
 * scroll into view, so the length here costs nothing until someone keeps
 * pressing Down.
 */
val HOME_SHELVES: List<Preset> = buildList {
    val lists = listOf(MOVIE_PRESETS, TV_PRESETS, ANIME_PRESETS)
    var index = 0
    while (lists.any { index < it.size }) {
        lists.forEach { presets -> presets.getOrNull(index)?.let(::add) }
        index++
    }
}

fun presetsFor(section: Section): List<Preset> = when (section) {
    Section.MOVIES -> MOVIE_PRESETS
    Section.TV -> TV_PRESETS
    Section.ANIME -> ANIME_PRESETS
}

/** Top-level browse destinations, mirroring the web app's nav. */
enum class Section(val slug: String, val label: String) {
    MOVIES("movies", "Movies"),
    TV("tv", "TV Shows"),
    ANIME("anime", "Anime");

    companion object {
        fun fromSlug(slug: String?): Section = entries.firstOrNull { it.slug == slug } ?: MOVIES
    }
}

/** TMDB genre id → name, for the labels under hero titles. */
private val GENRE_NAMES = mapOf(
    28 to "Action", 12 to "Adventure", 16 to "Animation", 35 to "Comedy", 80 to "Crime",
    99 to "Documentary", 18 to "Drama", 10751 to "Family", 14 to "Fantasy", 36 to "History",
    27 to "Horror", 10402 to "Music", 9648 to "Mystery", 10749 to "Romance", 878 to "Science Fiction",
    10770 to "TV Movie", 53 to "Thriller", 10752 to "War", 37 to "Western", 10759 to "Action & Adventure",
    10762 to "Kids", 10763 to "News", 10764 to "Reality", 10765 to "Sci-Fi & Fantasy", 10766 to "Soap",
    10767 to "Talk", 10768 to "War & Politics",
)

fun genreNames(ids: List<Int>, limit: Int = 3): String =
    ids.mapNotNull { GENRE_NAMES[it] }.take(limit).joinToString(" · ")
