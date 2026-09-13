import Foundation

/// The signed-in half of the API, spoken to the site's own `/api/account`
/// routes with the sealed session the sign-in handed over.
///
/// Deliberately not a second `TmdbClient`. That one memoises every response
/// for the life of the process, which is right for a catalogue every viewer
/// sees the same and wrong for a watchlist: the whole point of a write is that
/// the next read differs. Nothing here is cached, and every request carries
/// the session as a `Cookie` header — the same cookie the browser sends, so
/// the server reads it through the same code and the allowlist, the sealing
/// and the no-store headers all apply unchanged.
actor AccountClient {
    static let shared = AccountClient()

    private static let cookieName = "cfv_tmdb"

    private var sealed: String?

    private let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 20
        // The session goes in a header we write ourselves, and the server's
        // `Set-Cookie` on sign-out must not be applied to a jar we never read.
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        config.urlCache = nil
        return URLSession(configuration: config)
    }()

    private let decoder = JSONDecoder()

    func use(session sealed: String?) { self.sealed = sealed }

    // MARK: - Identity

    /// nil when there is no usable session, whether none was stored or the
    /// server no longer accepts the one that was.
    func me() async throws -> AccountProfile? {
        guard sealed != nil else { return nil }
        let data = try await request("GET", "/me")
        struct Me: Decodable { var signedIn = false }
        guard (try? decoder.decode(Me.self, from: data))?.signedIn == true else { return nil }
        return try decoder.decode(AccountProfile.self, from: data)
    }

    /// Hands the credentials back to TMDB by way of the site. Best-effort: the
    /// viewer is signed out locally either way.
    func logout() async {
        _ = try? await request("POST", "/logout", body: [String: String]())
    }

    // MARK: - Reads

    func states(_ type: MediaType, id: Int) async throws -> AccountStates {
        try await get("/tmdb/\(type.rawValue)/\(id)/account_states")
    }

    func collection(_ kind: LibraryKind, _ type: MediaType, accountId: Int, page: Int = 1) async throws -> Paged<MediaItem> {
        let path = "/tmdb/account/\(accountId)/\(kind.path)/\(type == .tv ? "tv" : "movies")"
        return try await get(path, ["sort_by": "created_at.desc", "page": String(page)])
    }

    /// The v4 half: keyed by the object id, and with no `sort_by` to offer —
    /// TMDB's own ranking is the only order these have.
    func recommendations(_ type: MediaType, objectId: String, page: Int = 1) async throws -> Paged<MediaItem> {
        try await get("/tmdb/4/account/\(objectId)/\(type.rawValue)/recommendations", ["page": String(page)])
    }

    func lists(objectId: String, page: Int = 1) async throws -> Paged<ListSummary> {
        try await get("/tmdb/4/account/\(objectId)/lists", ["page": String(page)])
    }

    func list(_ id: Int, page: Int = 1) async throws -> ListDetails {
        try await get("/tmdb/4/list/\(id)", ["page": String(page)])
    }

    /// TMDB answers 404 when the title is not on the list, so absence arrives
    /// as an error rather than as `success: false`.
    func isOnList(_ listId: Int, _ type: MediaType, id: Int) async -> Bool {
        let query = ["media_type": type.rawValue, "media_id": String(id)]
        return (try? await request("GET", "/tmdb/4/list/\(listId)/item_status", query: query)) != nil
    }

    // MARK: - Writes

    func setWatchlist(accountId: Int, _ type: MediaType, id: Int, on: Bool) async throws {
        try await post("/tmdb/account/\(accountId)/watchlist", ["media_type": type.rawValue, "media_id": id, "watchlist": on])
    }

    func setFavorite(accountId: Int, _ type: MediaType, id: Int, on: Bool) async throws {
        try await post("/tmdb/account/\(accountId)/favorite", ["media_type": type.rawValue, "media_id": id, "favorite": on])
    }

    func rate(_ type: MediaType, id: Int, value: Double) async throws {
        try await post("/tmdb/\(type.rawValue)/\(id)/rating", ["value": value])
    }

    func clearRating(_ type: MediaType, id: Int) async throws {
        _ = try await request("DELETE", "/tmdb/\(type.rawValue)/\(id)/rating")
    }

    /// Private unless said otherwise: TMDB's own default publishes a new list
    /// on the viewer's profile.
    func createList(name: String, description: String = "") async throws -> Int {
        let body: [String: Any] = ["name": name, "description": description, "iso_639_1": "en", "public": false]
        let data = try await request("POST", "/tmdb/4/list", body: body)
        return try decoder.decode(CreatedList.self, from: data).id
    }

    func updateList(_ id: Int, name: String, description: String) async throws {
        _ = try await request("PUT", "/tmdb/4/list/\(id)", body: ["name": name, "description": description])
    }

    func deleteList(_ id: Int) async throws {
        _ = try await request("DELETE", "/tmdb/4/list/\(id)")
    }

    func addToList(_ listId: Int, _ type: MediaType, id: Int) async throws {
        try await post("/tmdb/4/list/\(listId)/items", ["items": [["media_type": type.rawValue, "media_id": id]]])
    }

    func removeFromList(_ listId: Int, _ type: MediaType, id: Int) async throws {
        let body: [String: Any] = ["items": [["media_type": type.rawValue, "media_id": id]]]
        _ = try await request("DELETE", "/tmdb/4/list/\(listId)/items", body: body)
    }

    // MARK: - Plumbing

    private func get<T: Decodable>(_ path: String, _ query: [String: String] = [:]) async throws -> T {
        try decoder.decode(T.self, from: await request("GET", path, query: query))
    }

    private func post(_ path: String, _ body: [String: Any]) async throws {
        _ = try await request("POST", path, body: body)
    }

    @discardableResult
    private func request(_ method: String, _ path: String, query: [String: String] = [:], body: Any? = nil) async throws -> Data {
        var components = URLComponents(string: TmdbClient.siteURL + "/api/account" + path)!
        if !query.isEmpty { components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) } }

        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let sealed { request.setValue("\(Self.cookieName)=\(sealed)", forHTTPHeaderField: "Cookie") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        // Sign-out answers with a redirect the browser is meant to follow; here
        // the 303 is the success.
        if (200..<400).contains(status) { return data }
        if status == 401 { throw AccountError.signedOut }
        throw AccountError.server(status)
    }
}
