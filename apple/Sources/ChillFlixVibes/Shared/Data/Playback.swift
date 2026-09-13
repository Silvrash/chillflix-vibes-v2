import Foundation

/// What to play. `WindowGroup(for:)` needs a Codable value, and carrying the
/// whole request means the window can be restored by the system.
struct PlaybackTarget: Codable, Hashable, Identifiable {
    var type: MediaType
    var id: Int
    var title: String
    var season: Int = 1
    var episode: Int = 1
    var isAnime: Bool = false
    var posterPath: String?
    var backdropPath: String?
}
