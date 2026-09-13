import Foundation

/// Talks to the ChillFlixVibes deployment's own route handlers rather than to
/// TMDB directly: `/api/tmdb/<path>` proxies TMDB with the bearer token attached
/// server-side, so no API token ships inside the app — and the proxy's CDN
/// caching benefits this client too.
///
/// Responses are memoised for the process lifetime. Browsing means a lot of
/// back-and-forth between shelves and detail pages, and re-fetching every time
/// is what makes an app feel sluggish.
actor TmdbClient {
    static let shared = TmdbClient()

    /// The deployment this app reads from.
    nonisolated static let siteURL = "https://chillflixvibes.vercel.app"

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.urlCache = URLCache(memoryCapacity: 16 << 20, diskCapacity: 128 << 20)
        return URLSession(configuration: config)
    }()

    private var memo: [String: Data] = [:]
    private let decoder = JSONDecoder()

    private func data(path: String, query: [String: String] = [:]) async throws -> Data {
        var components = URLComponents(string: Self.siteURL + path)!
        if !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        let url = components.url!
        if let cached = memo[url.absoluteString] { return cached }

        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        if memo.count > 250 { memo.removeAll(keepingCapacity: true) }
        memo[url.absoluteString] = data
        return data
    }

    private func get<T: Decodable>(_ path: String, _ query: [String: String] = [:]) async throws -> T {
        try decoder.decode(T.self, from: await data(path: "/api/tmdb" + path, query: query))
    }

    /// Mixed movies and shows, each tagged with its own `media_type`.
    func trending(window: String = "day") async throws -> [MediaItem] {
        let page: Paged<MediaItem> = try await get("/trending/all/\(window)")
        return page.results.filter { $0.mediaTypeRaw == "movie" || $0.mediaTypeRaw == "tv" }
    }

    func discover(_ type: MediaType, filters: [String: String], page: Int = 1) async throws -> Paged<MediaItem> {
        try await get("/discover/\(type.rawValue)", filters.merging(["page": String(page)]) { _, new in new })
    }

    func search(_ type: MediaType, query: String) async throws -> Paged<MediaItem> {
        try await get("/search/\(type.rawValue)", ["query": query, "page": "1", "include_adult": "false"])
    }

    func details(_ type: MediaType, id: Int) async throws -> MediaDetails {
        try await get("/\(type.rawValue)/\(id)", ["append_to_response": "credits"])
    }

    func season(tvId: Int, number: Int) async throws -> SeasonDetails {
        try await get("/tv/\(tvId)/season/\(number)")
    }

    func recommendations(_ type: MediaType, id: Int) async throws -> [MediaItem] {
        let page: Paged<MediaItem> = try await get("/\(type.rawValue)/\(id)/recommendations")
        return page.results
    }

    /// TMDB id → AniList id, via the site's `/api/anime-id` handler. The anime
    /// player is keyed by AniList id; nil means "use the TMDB players".
    func anilistId(_ tmdbId: Int) async -> Int? {
        guard let data = try? await data(path: "/api/anime-id/\(tmdbId)") else { return nil }
        return (try? decoder.decode(AnimeIds.self, from: data))?.anilistId
    }
}
