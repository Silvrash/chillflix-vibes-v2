import Foundation

/// Curated discover filters — a port of `lib/presets.ts`, so the Mac app browses
/// the same shelves as the web and TV apps.
struct Preset: Identifiable, Hashable, Sendable {
    var name: String
    var type: MediaType
    var filters: [String: String]
    var id: String { name }
}

private let currentYear = Calendar.current.component(.year, from: Date())

private let animeFilters = ["with_genres": "16", "with_original_language": "ja"]

let moviePresets: [Preset] = [
    Preset(name: "Recommended Movies", type: .movie, filters: [
        "sort_by": "popularity.desc", "vote_average.gte": "7.5", "vote_count.gte": "250",
        "popularity.lte": "500", "primary_release_date.gte": "\(currentYear - 5)-01-01",
    ]),
    Preset(name: "Popular New Releases", type: .movie, filters: [
        "sort_by": "popularity.desc", "primary_release_date.gte": "\(currentYear)-01-01", "vote_count.gte": "500",
    ]),
    Preset(name: "Top Rated Classics", type: .movie, filters: [
        "sort_by": "vote_average.desc", "primary_release_date.lte": "\(currentYear - 23)-12-31", "vote_count.gte": "1000",
    ]),
    Preset(name: "Action-Packed Thrillers", type: .movie, filters: [
        "with_genres": "28,53", "sort_by": "popularity.desc", "vote_count.gte": "200",
    ]),
    Preset(name: "Epic Sci-Fi Adventures", type: .movie, filters: [
        "with_genres": "878", "sort_by": "popularity.desc", "vote_count.gte": "300",
    ]),
    Preset(name: "Animated Blockbusters", type: .movie, filters: ["with_genres": "16", "sort_by": "revenue.desc"]),
    Preset(name: "Horror Movies for the Brave", type: .movie, filters: [
        "with_genres": "27", "vote_average.gte": "6.0", "sort_by": "vote_count.desc",
    ]),
    Preset(name: "Critically Acclaimed Documentaries", type: .movie, filters: [
        "with_genres": "99", "sort_by": "vote_average.desc", "vote_count.gte": "200",
    ]),
]

let tvPresets: [Preset] = [
    Preset(name: "Recommended TV Shows", type: .tv, filters: [
        "sort_by": "popularity.desc", "vote_average.gte": "7.5", "vote_count.gte": "100",
        "popularity.lte": "500", "first_air_date.gte": "\(currentYear - 5)-01-01",
    ]),
    Preset(name: "Trending TV Shows", type: .tv, filters: [
        "sort_by": "popularity.desc", "first_air_date.lte": "\(currentYear)-01-01", "vote_count.gte": "500",
    ]),
    Preset(name: "Thrilling Action Shows", type: .tv, filters: [
        "with_genres": "10759,80", "sort_by": "popularity.desc", "vote_count.gte": "200",
    ]),
    Preset(name: "Epic Sci-Fi TV Shows", type: .tv, filters: [
        "with_genres": "10765", "sort_by": "popularity.desc", "vote_count.gte": "300",
    ]),
    Preset(name: "Classic TV Hits", type: .tv, filters: [
        "sort_by": "vote_average.desc", "first_air_date.lte": "\(currentYear - 23)-12-31", "vote_count.gte": "100",
    ]),
    Preset(name: "Insightful Documentary Series", type: .tv, filters: [
        "with_genres": "99", "sort_by": "vote_average.desc", "vote_count.gte": "200",
    ]),
]

let animePresets: [Preset] = [
    Preset(name: "Popular Anime", type: .tv, filters: animeFilters.merging([
        "sort_by": "popularity.desc", "vote_count.gte": "50",
    ]) { _, new in new }),
    Preset(name: "Top Rated Anime", type: .tv, filters: animeFilters.merging([
        "sort_by": "vote_average.desc", "vote_count.gte": "200",
    ]) { _, new in new }),
    Preset(name: "Anime Films", type: .movie, filters: animeFilters.merging([
        "sort_by": "popularity.desc", "vote_count.gte": "100",
    ]) { _, new in new }),
]

enum BrowseSection: String, CaseIterable, Identifiable, Sendable {
    case movies, tv, anime

    var id: String { rawValue }
    var label: String {
        switch self {
        case .movies: "Movies"
        case .tv: "TV Shows"
        case .anime: "Anime"
        }
    }
    var presets: [Preset] {
        switch self {
        case .movies: moviePresets
        case .tv: tvPresets
        case .anime: animePresets
        }
    }
}

/// Every shelf, round-robined across movies / TV / anime so the home screen
/// stays varied all the way down.
let homeShelves: [Preset] = {
    var out: [Preset] = []
    let lists = [moviePresets, tvPresets, animePresets]
    var index = 0
    while lists.contains(where: { index < $0.count }) {
        for list in lists where index < list.count { out.append(list[index]) }
        index += 1
    }
    return out
}()

/// Playback goes through the site's `/embed` route, which builds the provider
/// URL itself — so this app never constructs one. It only needs the labels and
/// the id of the chosen player, mirroring `data/Streams.kt`.
///
/// The id names the *provider* and the label names the *slot*, which are two
/// different things wherever the lineups differ: anime leads with vidnest where
/// everything else leads with vidlink, so both are "Main Player" to the viewer
/// while being providers a preference can tell apart. The id strings are shared
/// with the site and the TV app and must match them exactly.
struct PlayerChoice: Identifiable, Hashable, Sendable {
    let id: String
    let label: String
}

let playerVidlink = PlayerChoice(id: "vidlink", label: "Main Player")
let playerVidsrcEmbed = PlayerChoice(id: "vidsrc-embed", label: "Alternate Player")
let playerVidsrcTo = PlayerChoice(id: "vidsrc-to", label: "Backup Player")
let playerVidnest = PlayerChoice(id: "vidnest", label: "Main Player")

/// The same three lineups the site builds: anime leads with vidnest and drops
/// vidsrc.to, films drop it too, and everything else gets all three. The two
/// that move down a slot for anime are relabelled for the position they now
/// hold and keep the provider ids they have elsewhere.
func players(for type: MediaType, isAnime: Bool) -> [PlayerChoice] {
    if isAnime {
        return [
            playerVidnest,
            PlayerChoice(id: playerVidlink.id, label: "Alternate Player"),
            PlayerChoice(id: playerVidsrcEmbed.id, label: "Backup Player"),
        ]
    }
    if type == .tv { return [playerVidlink, playerVidsrcEmbed, playerVidsrcTo] }
    return [playerVidlink, playerVidsrcEmbed]
}

/// The chrome-less player page on the site. Building the URL here — rather than
/// a provider URL — keeps every client pointed at one place, so a fix to the
/// player lineup reaches all of them without shipping a new app.
func embedURL(type: MediaType, id: Int, season: Int, episode: Int, player: String, anilistId: Int?) -> URL {
    var components = URLComponents(string: "\(TmdbClient.siteURL)/embed/\(type.rawValue)/\(id)")!
    var items = [URLQueryItem(name: "player", value: player)]
    if type == .tv {
        items.append(URLQueryItem(name: "season", value: String(season)))
        items.append(URLQueryItem(name: "episode", value: String(episode)))
    }
    if let anilistId { items.append(URLQueryItem(name: "anilist", value: String(anilistId))) }
    components.queryItems = items
    return components.url!
}
