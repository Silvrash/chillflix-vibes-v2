import Foundation

/// TMDB response models — the Swift counterpart of `lib/tmdb/queries.ts` and of
/// the TV app's `data/Models.kt`. Only the fields the UI renders are declared;
/// everything else is ignored, so TMDB can keep adding fields harmlessly.

enum MediaType: String, Codable, Sendable {
    case movie, tv

    static func from(_ slug: String?) -> MediaType { slug == "tv" ? .tv : .movie }
}

struct Paged<T: Decodable & Sendable>: Decodable, Sendable {
    var page: Int = 1
    var results: [T] = []
    var totalPages: Int = 1

    enum CodingKeys: String, CodingKey {
        case page, results
        case totalPages = "total_pages"
    }
}

struct Genre: Decodable, Sendable, Hashable {
    let id: Int
    var name: String = ""
}

struct MediaItem: Decodable, Sendable, Identifiable, Hashable {
    let id: Int
    var title: String?
    var name: String?
    var overview: String = ""
    var posterPath: String?
    var backdropPath: String?
    var voteAverage: Double = 0
    var popularity: Double = 0
    var releaseDate: String?
    var firstAirDate: String?
    var mediaTypeRaw: String?
    var genreIds: [Int] = []

    enum CodingKeys: String, CodingKey {
        case id, title, name, overview, popularity
        case posterPath = "poster_path"
        case backdropPath = "backdrop_path"
        case voteAverage = "vote_average"
        case releaseDate = "release_date"
        case firstAirDate = "first_air_date"
        case mediaTypeRaw = "media_type"
        case genreIds = "genre_ids"
    }

    var displayTitle: String { title ?? name ?? "" }
    var year: String? {
        let date = releaseDate ?? firstAirDate ?? ""
        return date.count >= 4 ? String(date.prefix(4)) : nil
    }

    /// `/trending/all` tags each result with its own type; discover and search
    /// responses don't, so the caller's list type is the fallback.
    func mediaType(fallback: MediaType) -> MediaType {
        mediaTypeRaw.map { MediaType.from($0) } ?? fallback
    }
}

struct CastMember: Decodable, Sendable, Identifiable, Hashable {
    let id: Int
    var name: String = ""
    var character: String = ""
    var profilePath: String?

    enum CodingKeys: String, CodingKey {
        case id, name, character
        case profilePath = "profile_path"
    }
}

struct Credits: Decodable, Sendable { var cast: [CastMember] = [] }

struct Season: Decodable, Sendable, Identifiable, Hashable {
    var id: Int = 0
    var name: String = ""
    var seasonNumber: Int = 0
    var episodeCount: Int = 0

    enum CodingKeys: String, CodingKey {
        case id, name
        case seasonNumber = "season_number"
        case episodeCount = "episode_count"
    }
}

struct Episode: Decodable, Sendable, Identifiable, Hashable {
    var id: Int = 0
    var name: String = ""
    var overview: String = ""
    var episodeNumber: Int = 0
    var stillPath: String?
    var airDate: String?

    enum CodingKeys: String, CodingKey {
        case id, name, overview
        case episodeNumber = "episode_number"
        case stillPath = "still_path"
        case airDate = "air_date"
    }
}

struct SeasonDetails: Decodable, Sendable { var episodes: [Episode] = [] }

struct MediaDetails: Decodable, Sendable {
    var id: Int = 0
    var title: String?
    var name: String?
    var overview: String = ""
    var posterPath: String?
    var backdropPath: String?
    var voteAverage: Double = 0
    var releaseDate: String?
    var firstAirDate: String?
    var originalLanguage: String?
    var runtime: Int?
    var episodeRunTime: [Int] = []
    var numberOfSeasons: Int = 0
    var genres: [Genre] = []
    var seasons: [Season] = []
    var credits: Credits?

    enum CodingKeys: String, CodingKey {
        case id, title, name, overview, runtime, genres, seasons, credits
        case posterPath = "poster_path"
        case backdropPath = "backdrop_path"
        case voteAverage = "vote_average"
        case releaseDate = "release_date"
        case firstAirDate = "first_air_date"
        case originalLanguage = "original_language"
        case episodeRunTime = "episode_run_time"
        case numberOfSeasons = "number_of_seasons"
    }

    var displayTitle: String { title ?? name ?? "" }
    var year: String? {
        let date = releaseDate ?? firstAirDate ?? ""
        return date.count >= 4 ? String(date.prefix(4)) : nil
    }
    var runtimeMinutes: Int? { runtime ?? episodeRunTime.first }
    /// Seasons excluding "Specials" (season 0), which the players don't carry.
    var airedSeasons: [Season] { seasons.filter { $0.seasonNumber > 0 } }
    /// Japanese animation streams from a different provider, detected the same
    /// way the web app does it.
    var isAnime: Bool { genres.contains { $0.id == 16 } && originalLanguage == "ja" }
}

struct AnimeIds: Decodable, Sendable { var anilistId: Int? }

enum TmdbImage {
    private static let base = "https://image.tmdb.org/t/p/"
    static func url(_ path: String?, size: String = "w342") -> URL? {
        guard let path, !path.isEmpty else { return nil }
        return URL(string: base + size + path)
    }
}
