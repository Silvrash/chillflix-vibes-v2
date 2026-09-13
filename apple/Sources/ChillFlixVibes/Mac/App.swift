import AppKit
import SwiftUI

@main
struct ChillFlixVibesApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 1000, minHeight: 660)
                .preferredColorScheme(.dark)
        }
        // No titlebar strip, so a hero runs to the top edge of the window the
        // way it runs to the top of the page on the web. The traffic lights and
        // the back chevron float over the artwork instead.
        .windowStyle(.hiddenTitleBar)
        .commands { CommandGroup(replacing: .newItem) {} }

    }
}

/// Puts the window back on a screen the viewer can see.
///
/// AppKit restores a window to the frame it last had, and does not check that
/// the frame is still reachable. Unplug the display it was on, or open the app
/// on a machine whose screens are arranged differently, and it comes back at
/// coordinates that no longer exist — off the left edge, or on a screen that is
/// not there. The window is then only recoverable through Window > Zoom, which
/// a viewer who cannot see the window has no reason to look for.
///
/// A restored frame is honoured whenever it genuinely overlaps a screen; this
/// only steps in when it does not.
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // After the run loop turn in which SwiftUI restores the frame, or the
        // clamp would be overwritten by the restore it is correcting.
        DispatchQueue.main.async {
            NSApp.windows.forEach {
                Self.bringOnScreen($0)
                Self.configureWindow($0)
            }
        }

        // Re-applied as windows update, not just once: a window opened later has
        // not been through the above, and pushing a screen hands SwiftUI's own
        // toolbar back to a window that had already been configured. The work is
        // idempotent and cheap.
        NotificationCenter.default.addObserver(
            forName: NSWindow.didUpdateNotification, object: nil, queue: .main
        ) { note in
            guard let window = note.object as? NSWindow else { return }
            Self.configureWindow(window)
        }
    }

    /// Keeps the titlebar — and so the close, minimise and full-screen buttons —
    /// while leaving no strip for it to occupy.
    ///
    /// Hiding the window toolbar outright does remove the grey band a pushed
    /// screen was inset by, but on this window it takes the titlebar's buttons
    /// with it: `standardWindowButton` then has nothing to return, and the
    /// window cannot be closed, minimised or zoomed with the mouse at all.
    ///
    /// So the titlebar stays and is made invisible instead. `fullSizeContentView`
    /// lets the artwork run underneath it, a transparent titlebar with no
    /// separator leaves nothing drawn over the artwork, and an empty toolbar
    /// occupies no height — which is the band, gone, with the buttons still
    /// floating in the corner where macOS puts them.
    private static func configureWindow(_ window: NSWindow) {
        window.styleMask.insert(.fullSizeContentView)
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.titlebarSeparatorStyle = .none
        window.isMovableByWindowBackground = true

        // SwiftUI hands a pushed screen a toolbar to hold its back chevron. The
        // app draws its own in the nav pill, so this one only ever contributed
        // the band.
        if let toolbar = window.toolbar {
            toolbar.showsBaselineSeparator = false
            toolbar.isVisible = false
        }

        for button: NSWindow.ButtonType in [.closeButton, .miniaturizeButton, .zoomButton] {
            window.standardWindowButton(button)?.isHidden = false
            window.standardWindowButton(button)?.alphaValue = 1
        }
    }

    private static func bringOnScreen(_ window: NSWindow) {
        let screens = NSScreen.screens.map(\.visibleFrame)
        guard !screens.isEmpty else { return }

        // "Visible" means a decent piece of it, not a sliver: a window showing
        // ten pixels down the edge of the screen is as lost as one showing none.
        let showing = screens.map { $0.intersection(window.frame) }.map { $0.width * $0.height }.max() ?? 0
        let enough = window.frame.width * window.frame.height * 0.35
        guard showing < enough else { return }

        let target = (NSScreen.main ?? NSScreen.screens[0]).visibleFrame
        var frame = window.frame
        frame.size.width = min(frame.width, target.width)
        frame.size.height = min(frame.height, target.height)
        frame.origin.x = target.midX - frame.width / 2
        frame.origin.y = target.midY - frame.height / 2
        window.setFrame(frame, display: true)
    }
}

struct ContentView: View {
    @State private var destination: Destination = .home
    @State private var path = NavigationPath()
    @StateObject private var account = AccountStore.shared

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                switch destination {
                case .home: HomeView()
                case .section(let section): BrowseView(section: section)
                case .search: SearchView()
                }
            }
            .navigationDestination(for: Route.self) { route in
                Group {
                    switch route {
                    case let .detail(type, id): DetailView(type: type, id: id)
                    case let .play(target): PlayerWindow(target: target)
                    case let .network(network): BrowseView(section: .tv, initialNetwork: network)
                    case let .library(kind): LibraryView(kind: kind)
                    case .recommendations: RecommendationsView()
                    case .lists: ListsView()
                    case let .list(id): ListDetailView(id: id)
                    }
                }
            }
        }
        // Whoever signed in last time is picked up before anything asks: the
        // store is `ready` only once the keychain has been checked, so no
        // account control renders in the wrong state on the way in.
        .task { await account.restore() }
        .alert("Something went wrong", isPresented: Binding(get: { account.failure != nil }, set: { if !$0 { account.failure = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(account.failure ?? "")
        }
        .background(Palette.background)
        // Both of these float *over* the screen rather than taking a strip of
        // it, so a hero runs full-bleed underneath. Every screen that isn't led
        // by artwork starts `Metric.navClearance` down instead.
        .overlay(alignment: .top) {
            NavPill(
                destination: destination,
                select: go,
                open: { path.append($0) },
                back: path.isEmpty ? nil : { path.removeLast() }
            )
            // The pill has to measure from the same top edge its screens do.
            // They all ignore the inset the window reserves for a titlebar it
            // asked not to have; the overlay did not, so the pill hung ~40pt
            // lower than its own 14pt inset while `Metric.navClearance` was
            // measured from the real top — the gap between them coming out
            // different on a pushed screen, which is where it showed.
            .ignoresSafeArea(edges: .top)
        }
        // Outermost on purpose. An environment object reaches children, and
        // the nav pill is an overlay — a sibling of the stack, not a child of
        // it — so injected any nearer in, the pill's account item would find
        // nothing and trap.
        .environmentObject(account)
    }

    /// Picking a page is arriving somewhere new, not a step deeper: whatever
    /// title or player is stacked on the old page goes with it.
    private func go(_ next: Destination) {
        path = NavigationPath()
        destination = next
    }
}

/// The app's navigation: a floating glass pill, centred at the top of the
/// window, over whatever the screen is showing.
///
/// It is centred rather than pinned left because the traffic lights live in the
/// top-left corner of a window with no titlebar. The window's minimum width is
/// far wider than this pill plus twice that corner, so the two can never meet —
/// which is what keeps the buttons clickable with no chrome reserved for them.
/// The way back out of a pushed screen, living inside the nav pill.
///
/// It is drawn rather than left to the window toolbar, which reserves a strip
/// across the top of the window to hold it. Putting it in the pill rather than
/// floating it in the corner is what keeps it off every screen's own content:
/// a detail page, the player and a browse screen opened from a network tile all
/// draw their title in the top-left, and a chevron parked there lands on the
/// words. The corner is left to the traffic lights, which `.hiddenTitleBar`
/// leaves floating there and which the app cannot move.
private struct BackButton: View {
    let action: () -> Void

    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            Image(systemName: "chevron.left")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(hovering ? .white : Palette.muted)
                .frame(width: 30, height: 32)
                .background(
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .fill(hovering ? Palette.glass : .clear)
                )
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .animation(.easeOut(duration: 0.12), value: hovering)
        .help("Back")
        .keyboardShortcut("[", modifiers: .command)
    }
}

private struct NavPill: View {
    let destination: Destination
    let select: (Destination) -> Void
    /// Pushes a screen onto whatever page is showing — the account menu's
    /// destinations are rooms of the viewer's, not pages of the site.
    let open: (Route) -> Void
    /// Non-nil while there is somewhere to go back to.
    var back: (() -> Void)?

    var body: some View {
        HStack(spacing: 6) {
            if let back {
                BackButton(action: back)
                Rectangle()
                    .fill(Palette.hairline)
                    .frame(width: 1, height: 20)
                    .padding(.horizontal, 2)
            }

            brand

            ForEach(Destination.pages, id: \.self) { page in
                NavPillItem(
                    destination: page,
                    active: page == destination,
                    action: { select(page) }
                )
            }

            Rectangle()
                .fill(Palette.hairline)
                .frame(width: 1, height: 20)
                .padding(.horizontal, 2)

            NavPillItem(
                destination: .search,
                active: destination == .search,
                shortcut: "⌘K",
                action: { select(.search) }
            )
            // The web app's own binding for the same control. A pill has no room
            // to spell "Search movies and shows", so the shortcut is the part of
            // it that stays reachable without reading the label.
            .keyboardShortcut("k", modifiers: .command)

            Rectangle()
                .fill(Palette.hairline)
                .frame(width: 1, height: 20)
                .padding(.horizontal, 2)

            AccountPillItem(open: open)
        }
        .padding(6)
        .glass(radius: Metric.panelRadius, fill: Color.black.opacity(0.45))
        .padding(.top, 14)
    }

    /// The mark doubles as the way home, exactly as it does on the web.
    private var brand: some View {
        Button { select(.home) } label: {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Palette.brand)
                .frame(width: 32, height: 32)
                .overlay(
                    Image(systemName: Self.clapperboard)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                )
        }
        .buttonStyle(.plain)
        .help("ChillFlixVibes home")
    }

    /// The web app's mark is a clapperboard (lucide's `Clapperboard`), and the
    /// two are meant to read as one product. SF Symbols only grew one in 5,
    /// which ships with macOS 14, so 13 falls back to the filmstrip.
    private static var clapperboard: String {
        if #available(macOS 14.0, *) { return "movieclapper.fill" }
        return "film.fill"
    }
}

/// One destination in the pill: icon, label, and a soft white fill while it is
/// the page you are on.
private struct NavPillItem: View {
    let destination: Destination
    let active: Bool
    var shortcut: String?
    let action: () -> Void

    @State private var hovering = false

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
        return Button(action: action) {
            HStack(spacing: 7) {
                Image(systemName: destination.symbol)
                    .font(.system(size: 12, weight: .medium))
                Text(destination.label)
                    .font(.system(size: 13, weight: .medium))
                if let shortcut {
                    Text(shortcut)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Palette.muted)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 5, style: .continuous))
                }
            }
            .foregroundStyle(active || hovering ? Color.white : Palette.muted)
            .padding(.horizontal, 13)
            .padding(.vertical, 9)
            .background(
                active ? Color.white.opacity(0.10) : hovering ? Color.white.opacity(0.05) : .clear,
                in: shape
            )
            .contentShape(shape)
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .animation(.easeOut(duration: 0.12), value: hovering)
    }
}

/// The pill's last item: "Sign in" when signed out, the viewer's name and
/// avatar with a menu of their collections when in. The same control the
/// site's navbar ends with, in the same place.
///
/// Nothing at all until the store is ready — rendering "Sign in" and then
/// swapping it for a name a moment later would visibly resize the pill.
private struct AccountPillItem: View {
    let open: (Route) -> Void

    @EnvironmentObject private var account: AccountStore
    @State private var hovering = false

    var body: some View {
        if !account.ready {
            EmptyView()
        } else if let profile = account.profile {
            Menu {
                Button { open(.library(.watchlist)) } label: { Label("Watchlist", systemImage: "bookmark") }
                Button { open(.library(.favorites)) } label: { Label("Favourites", systemImage: "heart") }
                Button { open(.library(.ratings)) } label: { Label("Ratings", systemImage: "star") }
                Button { open(.lists) } label: { Label("Lists", systemImage: "text.badge.plus") }
                Button { open(.recommendations) } label: { Label("For you", systemImage: "sparkles") }
                Divider()
                Button {
                    Task { await account.signOut() }
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            } label: {
                HStack(spacing: 7) {
                    Avatar(path: profile.avatarPath, initial: profile.username.first.map(String.init) ?? "?")
                    Text(profile.username)
                        .font(.system(size: 13, weight: .medium))
                        .lineLimit(1)
                        .frame(maxWidth: 96, alignment: .leading)
                        .fixedSize(horizontal: true, vertical: false)
                }
                .foregroundStyle(hovering ? Color.white : Palette.muted)
                .padding(.leading, 8)
                .padding(.trailing, 13)
                .padding(.vertical, 7)
                .background(hovering ? Color.white.opacity(0.05) : .clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
            .menuIndicator(.hidden)
            .fixedSize()
            .onHover { hovering = $0 }
            .animation(.easeOut(duration: 0.12), value: hovering)
            .help("Account: \(profile.username)")
        } else {
            Button {
                Task { await account.signIn() }
            } label: {
                HStack(spacing: 7) {
                    Image(systemName: "person.crop.circle")
                        .font(.system(size: 12, weight: .medium))
                    Text("Sign in")
                        .font(.system(size: 13, weight: .medium))
                }
                .foregroundStyle(hovering ? Color.white : Palette.muted)
                .padding(.horizontal, 13)
                .padding(.vertical, 9)
                .background(hovering ? Color.white.opacity(0.05) : .clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(account.busy)
            .onHover { hovering = $0 }
            .animation(.easeOut(duration: 0.12), value: hovering)
            .help("Sign in with your TMDB account")
        }
    }
}

/// The viewer's TMDB avatar, or their initial in a small tile when they have
/// not set one.
private struct Avatar: View {
    let path: String?
    let initial: String

    var body: some View {
        Group {
            if let url = TmdbImage.url(path, size: "w45") {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    fallback
                }
            } else {
                fallback
            }
        }
        .frame(width: 22, height: 22)
        .clipShape(Circle())
    }

    private var fallback: some View {
        Circle()
            .fill(Color.white.opacity(0.10))
            .overlay(
                Text(initial.uppercased())
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
            )
    }
}
