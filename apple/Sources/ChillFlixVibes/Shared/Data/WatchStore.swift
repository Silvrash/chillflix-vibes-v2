import Foundation

/// Local playback state — the Swift counterpart of `lib/storage.ts` and the TV
/// app's `WatchStore.kt`. Small enough for UserDefaults; the point is that
/// "Continue watching" is the shortest path back into a series.
struct WatchEntry: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let type: String
    let title: String
    var posterPath: String?
    var backdropPath: String?
    var season: Int = 1
    var episode: Int = 1
    var updatedAt: Date = .now

    var mediaType: MediaType { MediaType.from(type) }

    var asMediaItem: MediaItem {
        var item = MediaItem(id: id)
        item.title = title
        item.posterPath = posterPath
        item.backdropPath = backdropPath
        item.mediaTypeRaw = type
        return item
    }
}

@MainActor
final class WatchStore: ObservableObject {
    static let shared = WatchStore()

    @Published private(set) var continueWatching: [WatchEntry] = []

    private let defaults = UserDefaults.standard
    private let key = "continue-watching"
    private let maxEntries = 20

    private init() { load() }

    private func load() {
        guard let data = defaults.data(forKey: key),
              let entries = try? JSONDecoder().decode([WatchEntry].self, from: data) else { return }
        continueWatching = entries.sorted { $0.updatedAt > $1.updatedAt }
    }

    /// Where the user last was in this title, defaulting to S1·E1.
    func lastWatched(_ type: MediaType, _ id: Int) -> (season: Int, episode: Int) {
        guard let entry = continueWatching.first(where: { $0.id == id && $0.type == type.rawValue }) else {
            return (1, 1)
        }
        return (entry.season, entry.episode)
    }

    /// Records a title as in progress, moving it to the front of the shelf.
    func record(_ entry: WatchEntry) {
        var updated = continueWatching.filter { !($0.id == entry.id && $0.type == entry.type) }
        var fresh = entry
        fresh.updatedAt = .now
        updated.insert(fresh, at: 0)
        continueWatching = Array(updated.prefix(maxEntries))
        if let data = try? JSONEncoder().encode(continueWatching) {
            defaults.set(data, forKey: key)
        }
    }
}
