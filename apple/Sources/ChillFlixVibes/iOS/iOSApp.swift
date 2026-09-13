import SwiftUI

/// The iPhone and iPad shell over the shared screens.
///
/// Where the Mac app floats a nav pill over a wide window, this one keeps the
/// platform's own furniture: a tab bar for the site's sections, a navigation
/// bar with the system back button on every pushed screen, and the account as
/// a tab of its own rather than an item in a pill. Everything below that
/// chrome — the shelves, the grids, the detail page, the account screens — is
/// the same code the Mac app draws.
@main
struct ChillFlixVibesApp: App {
    @StateObject private var account = AccountStore.shared

    var body: some Scene {
        WindowGroup {
            RootTabs()
                .environmentObject(account)
                .preferredColorScheme(.dark)
                .tint(.white)
                .task { await account.restore() }
                .alert("Something went wrong", isPresented: Binding(get: { account.failure != nil }, set: { if !$0 { account.failure = nil } })) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text(account.failure ?? "")
                }
        }
    }
}

/// The site's sections as tabs, in the nav pill's own order, then search and
/// the viewer's own things.
struct RootTabs: View {
    enum Section: Hashable { case home, browse, search, account }

    @State private var tab: Section = .home
    /// A route to push onto the chosen tab once it exists — see `openFromLaunchArguments`.
    @State private var pending: Route?
    @State private var path = NavigationPath()

    var body: some View {
        TabView(selection: $tab) {
            Tab("Home", systemImage: "house", value: .home) { stack { HomeView() } }
            Tab("Browse", systemImage: "square.grid.2x2", value: .browse) { stack { BrowseTab() } }
            Tab("My Stuff", systemImage: "person.crop.circle", value: .account) { stack { AccountTab() } }
            // The search role is what pulls it out of the row: the system
            // draws it as its own button beside the bar.
            Tab(value: .search, role: .search) { stack { SearchView() } }
        }
        .onAppear(perform: openFromLaunchArguments)
    }

    /// Opens a given screen at launch — `-cfv-tab browse`, `-cfv-route
    /// detail/tv/1399` — so a screen can be reached from `simctl launch`
    /// without a finger on the glass. Reads the arguments the process was
    /// started with, which is a development affordance and nothing a viewer
    /// can reach.
    private func openFromLaunchArguments() {
        let defaults = UserDefaults.standard
        switch defaults.string(forKey: "cfv-tab") {
        case "browse": tab = .browse
        case "account": tab = .account
        case "search": tab = .search
        default: break
        }
        // `-cfv-signin 1` starts the sign-in the moment the app is up, so the
        // system's authentication sheet can be seen to present on this platform
        // — the one step of sign-in a screenshot can verify.
        if defaults.bool(forKey: "cfv-signin") {
            // A beat after launch, once the window is key: the session needs a
            // window to present from and refuses to start without one.
            Task {
                try? await Task.sleep(for: .seconds(1))
                await AccountStore.shared.signIn()
            }
        }
        guard let spec = defaults.string(forKey: "cfv-route") else { return }
        let parts = spec.split(separator: "/").map(String.init)
        switch parts.first {
        case "detail" where parts.count == 3:
            if let id = Int(parts[2]) { pending = .detail(MediaType.from(parts[1]), id) }
        case "library" where parts.count == 2:
            if let kind = LibraryKind(rawValue: parts[1]) { pending = .library(kind) }
        case "lists": pending = .lists
        case "recommendations": pending = .recommendations
        case "play" where parts.count == 3:
            if let id = Int(parts[2]) {
                pending = .play(PlaybackTarget(type: MediaType.from(parts[1]), id: id, title: "Playback"))
            }
        default: break
        }
    }

    /// Every tab is its own stack, so going back inside Movies never lands on
    /// something pushed from Home, and each keeps its place when tabs change.
    private func stack<Root: View>(@ViewBuilder _ root: () -> Root) -> some View {
        NavigationStack(path: $path) {
            root()
                .onChange(of: pending, initial: true) { _, route in
                    guard let route else { return }
                    path.append(route)
                    pending = nil
                }
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case let .detail(type, id): DetailView(type: type, id: id)
                    case let .play(target): PlayerScreen(target: target)
                    case let .network(network): BrowseView(section: .tv, initialNetwork: network)
                    case let .library(kind): LibraryView(kind: kind)
                    case .recommendations: RecommendationsView()
                    case .lists: ListsView()
                    case let .list(id): ListDetailView(id: id)
                    }
                }
        }
    }
}
