import Foundation

/// What the app is allowed to know about the viewer — the same profile the
/// site's `/api/account/me` gives the browser, and never a credential.
struct AccountProfile: Codable, Equatable, Sendable {
    let accountId: Int
    let accountObjectId: String
    let username: String
    let avatarPath: String?
}

/// Whether this viewer has favourited, watchlisted or rated one title.
struct AccountStates: Decodable, Sendable, Equatable {
    var favorite = false
    var watchlist = false
    /// TMDB spells "not rated" as the literal `false` and a rating as
    /// `{ "value": 8 }`, so this cannot be a plain optional number.
    var rating: Double?

    enum CodingKeys: String, CodingKey { case favorite, watchlist, rated }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        favorite = try c.decodeIfPresent(Bool.self, forKey: .favorite) ?? false
        watchlist = try c.decodeIfPresent(Bool.self, forKey: .watchlist) ?? false
        if let rated = try? c.decode(Rated.self, forKey: .rated) { rating = rated.value }
    }

    private struct Rated: Decodable { let value: Double }
}

/// TMDB answers every account write with this, whatever the endpoint.
struct StatusResponse: Decodable, Sendable {
    var success: Bool?
    var statusCode: Int = 0
    var statusMessage: String = ""

    enum CodingKeys: String, CodingKey {
        case success
        case statusCode = "status_code"
        case statusMessage = "status_message"
    }
}

/// One of the viewer's lists, as `GET /4/account/{id}/lists` summarises it.
struct ListSummary: Decodable, Sendable, Identifiable, Hashable {
    let id: Int
    var name: String = ""
    var description: String = ""
    var numberOfItems: Int = 0
    var isPublic = false
    var posterPath: String?
    var backdropPath: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description
        case numberOfItems = "number_of_items"
        case isPublic = "public"
        case posterPath = "poster_path"
        case backdropPath = "backdrop_path"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        numberOfItems = try c.decodeIfPresent(Int.self, forKey: .numberOfItems) ?? 0
        posterPath = try c.decodeIfPresent(String.self, forKey: .posterPath)
        backdropPath = try c.decodeIfPresent(String.self, forKey: .backdropPath)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
        // 0 or 1 from the account listing but a real boolean from the list's
        // own page. TMDB genuinely answers both shapes.
        if let flag = try? c.decode(Bool.self, forKey: .isPublic) {
            isPublic = flag
        } else if let flag = try? c.decode(Int.self, forKey: .isPublic) {
            isPublic = flag != 0
        }
    }
}

/// A list's own page, which carries one page of its titles inline.
struct ListDetails: Decodable, Sendable {
    var id: Int = 0
    var name: String = ""
    var description: String = ""
    var itemCount: Int = 0
    var results: [MediaItem] = []
    var page: Int = 1
    var totalPages: Int = 1

    enum CodingKeys: String, CodingKey {
        case id, name, description, results, page
        case itemCount = "item_count"
        case totalPages = "total_pages"
    }
}

/// `POST /4/list` answers with the new list's id alongside the usual status.
struct CreatedList: Decodable, Sendable {
    var id: Int = 0
    var success: Bool?
}

/// The three collections TMDB keeps per account, addressed by the numeric id.
enum LibraryKind: String, CaseIterable, Hashable, Sendable {
    case watchlist, favorites, ratings

    var path: String {
        switch self {
        case .watchlist: "watchlist"
        case .favorites: "favorite"
        case .ratings: "rated"
        }
    }

    var title: String {
        switch self {
        case .watchlist: "Your watchlist"
        case .favorites: "Your favourites"
        case .ratings: "Your ratings"
        }
    }

    var blurb: String {
        switch self {
        case .watchlist: "Titles you have saved on TMDB. They follow your account, not this device."
        case .favorites: "Titles you have marked as favourites on TMDB."
        case .ratings: "Titles you have scored on TMDB. These are what its recommendations for you are built from."
        }
    }

    var emptyMessage: String {
        switch self {
        case .watchlist: "Add a title from its page and it will show up here."
        case .favorites: "Mark a title as a favourite and it will show up here."
        case .ratings: "Rate a title out of ten from its page and it will show up here."
        }
    }

    var symbol: String {
        switch self {
        case .watchlist: "bookmark"
        case .favorites: "heart"
        case .ratings: "star"
        }
    }
}

enum AccountError: Error {
    /// The stored session no longer opens a door: expired, revoked, or the
    /// server's secret rotated. The only honest response is signing out.
    case signedOut
    case server(Int)
}
