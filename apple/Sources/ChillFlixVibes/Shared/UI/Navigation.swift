import SwiftUI

/// One destination, so navigation state stays in a single place.
enum Route: Hashable {
    case detail(MediaType, Int)
    case play(PlaybackTarget)
    /// A network tile opens the series catalogue already filtered to it. Pushed
    /// rather than selected in the pill, because it is a narrowing of TV Shows
    /// rather than a destination of its own.
    case network(NetworkFilter)
    /// The signed-in collections. Pushed like a title rather than picked in the
    /// pill: they are the viewer's rooms, not the site's sections.
    case library(LibraryKind)
    case recommendations
    case lists
    case list(Int)
}

/// A top-level destination — a page of the site, in the nav pill's own order.
enum Destination: Hashable {
    case home
    case section(BrowseSection)
    case search

    /// Everything the pill lists before the hairline. Search sits past it, as an
    /// action rather than a section, which is how the web app's navbar reads.
    static let pages: [Destination] = [.home] + BrowseSection.allCases.map(Destination.section)

    var label: String {
        switch self {
        case .home: "Home"
        case .section(let section): section.label
        case .search: "Search"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house"
        case .section(.movies): "film"
        case .section(.tv): "tv"
        case .section(.anime): "sparkles"
        case .search: "magnifyingglass"
        }
    }
}
