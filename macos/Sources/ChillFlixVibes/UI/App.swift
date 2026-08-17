import SwiftUI

@main
struct ChillFlixVibesApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 960, minHeight: 620)
                .preferredColorScheme(.dark)
        }
        .windowStyle(.hiddenTitleBar)
        .commands { CommandGroup(replacing: .newItem) {} }
    }
}

/// The app's palette, matching `tailwind.config.ts` so the Mac app and the web
/// app read as the same product.
enum Palette {
    static let background = Color(red: 0.039, green: 0.055, blue: 0.090)
    static let surface = Color(red: 0.063, green: 0.094, blue: 0.153)
    static let surfaceLight = Color(red: 0.106, green: 0.145, blue: 0.212)
    static let primary = Color(red: 0.247, green: 0.514, blue: 0.973)
    static let muted = Color(red: 0.608, green: 0.631, blue: 0.651)
    static let accent = Color(red: 0.675, green: 0.761, blue: 0.925)
}

/// One destination, so navigation state stays in a single place.
enum Route: Hashable {
    case detail(MediaType, Int)
}

/// Sidebar destinations. Search sits alongside the browse sections rather than
/// in a toolbar, so it's reachable from anywhere in one click.
enum Destination: Hashable {
    case home
    case section(BrowseSection)
    case search
}

struct ContentView: View {
    @State private var destination: Destination? = .home
    @State private var path = NavigationPath()

    var body: some View {
        NavigationSplitView {
            List(selection: $destination) {
                Label("Home", systemImage: "house").tag(Destination.home)
                Section("Browse") {
                    ForEach(BrowseSection.allCases) { item in
                        Label(item.label, systemImage: icon(for: item)).tag(Destination.section(item))
                    }
                }
                Label("Search", systemImage: "magnifyingglass").tag(Destination.search)
            }
            .navigationSplitViewColumnWidth(min: 180, ideal: 200)
        } detail: {
            NavigationStack(path: $path) {
                Group {
                    switch destination {
                    case .section(let section): BrowseView(section: section)
                    case .search: SearchView()
                    default: HomeView()
                    }
                }
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case let .detail(type, id): DetailView(type: type, id: id)
                    }
                }
            }
        }
        .background(Palette.background)
    }

    private func icon(for section: BrowseSection) -> String {
        switch section {
        case .movies: "film"
        case .tv: "tv"
        case .anime: "sparkles"
        }
    }
}
