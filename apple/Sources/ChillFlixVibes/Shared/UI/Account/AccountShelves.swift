import SwiftUI

/// The home page's two rows about the viewer rather than about what is
/// popular. Both render nothing when signed out or empty — no heading, no
/// placeholder — so the page is unchanged for anyone who never signs in.
///
/// Films and series come back as two lists and are taken in turn rather than
/// one after the other, for the reason the site's `interleave` exists: a shelf
/// shows a bounded head, and a full page of films would fill it before the
/// first series was reached.

struct WatchlistShelf: View {
    @EnvironmentObject private var account: AccountStore
    @State private var items: [MediaItem] = []

    var body: some View {
        if account.isSignedIn {
            MediaShelf(title: "Your watchlist", items: items, fallback: .movie, more: .library(.watchlist))
                .task(id: account.revision) { await load() }
        }
    }

    private func load() async {
        guard let profile = account.profile else { return }
        async let films = AccountClient.shared.collection(.watchlist, .movie, accountId: profile.accountId)
        async let series = AccountClient.shared.collection(.watchlist, .tv, accountId: profile.accountId)
        let (movies, shows) = ((try? await films)?.results ?? [], (try? await series)?.results ?? [])
        items = Array(interleave(movies.stamped(.movie), shows.stamped(.tv)).filter { $0.posterPath != nil }.prefix(20))
    }
}

struct RecommendedShelf: View {
    @EnvironmentObject private var account: AccountStore
    @State private var items: [MediaItem] = []

    var body: some View {
        if account.isSignedIn {
            MediaShelf(title: "Recommended for you", items: items, fallback: .movie, more: .recommendations)
                .task(id: account.revision) { await load() }
        }
    }

    private func load() async {
        guard let profile = account.profile else { return }
        async let films = AccountClient.shared.recommendations(.movie, objectId: profile.accountObjectId)
        async let series = AccountClient.shared.recommendations(.tv, objectId: profile.accountObjectId)
        let (movies, shows) = ((try? await films)?.results ?? [], (try? await series)?.results ?? [])
        items = Array(interleave(movies.stamped(.movie), shows.stamped(.tv)).filter { $0.posterPath != nil }.prefix(20))
    }
}

extension Array where Element == MediaItem {
    /// Account responses name no `media_type` — the path already said which —
    /// so the type is stamped on before the two halves are merged into a row
    /// that draws both. Without it every series would link to a film.
    func stamped(_ type: MediaType) -> [MediaItem] {
        map { item in
            var copy = item
            copy.mediaTypeRaw = type.rawValue
            return copy
        }
    }
}

/// One from each in turn, keeping each list's own order within its half.
func interleave<T>(_ first: [T], _ second: [T]) -> [T] {
    var merged: [T] = []
    merged.reserveCapacity(first.count + second.count)
    for index in 0..<Swift.max(first.count, second.count) {
        if index < first.count { merged.append(first[index]) }
        if index < second.count { merged.append(second[index]) }
    }
    return merged
}
