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
        DispatchQueue.main.async { NSApp.windows.forEach(Self.bringOnScreen) }
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

/// The app's palette, matching `tailwind.config.ts` so the Mac app and the web
/// app read as the same product.
///
/// Every value bar the brand mark and the rating star is neutral. Artwork is the
/// only colour on a streaming page, and a tinted ground or a tinted panel
/// competes with every poster on the screen.
enum Palette {
    static let background = Palette.hex(0x0A0A0A)
    static let surface = Palette.hex(0x141414)
    static let surfaceLight = Palette.hex(0x1F1F1F)
    static let muted = Palette.hex(0xA1A1AA)
    static let accent = Palette.hex(0xD4D4D8)
    /// The one place a brand colour is spent, on the mark itself — the same
    /// `primary-dark` tile the web app's navbar and footer carry.
    static let brand = Palette.hex(0x2563EB)
    static let rating = Palette.hex(0xFBBF24)

    /// Hairlines and glass fills are white at low opacity rather than fixed
    /// greys, so they hold their weight over pale artwork as well as over the
    /// ground.
    static let hairline = Color.white.opacity(0.10)
    static let hairlineBright = Color.white.opacity(0.25)
    static let glass = Color.white.opacity(0.10)
    static let glassHover = Color.white.opacity(0.18)
    /// The other glass: black rather than white, for the small plates that sit
    /// *on* artwork and have to stay legible over a pale frame.
    static let scrim = Color.black.opacity(0.6)

    private static func hex(_ value: UInt32) -> Color {
        Color(
            .sRGB,
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}

/// One destination, so navigation state stays in a single place.
enum Route: Hashable {
    case detail(MediaType, Int)
    case play(PlaybackTarget)
    /// A network tile opens the series catalogue already filtered to it. Pushed
    /// rather than selected in the pill, because it is a narrowing of TV Shows
    /// rather than a destination of its own.
    case network(NetworkFilter)
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

struct ContentView: View {
    @State private var destination: Destination = .home
    @State private var path = NavigationPath()

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
                    }
                }
                // Every pushed screen hides it again for itself. The modifier on
                // the stack below covers the root only: a destination is handed
                // its own toolbar for the back chevron, so hiding it once out
                // there leaves every pushed screen inset by a strip the root
                // does not have — the pill and the heading both sitting lower on
                // a detail page than on home, which is exactly how it looked.
                .toolbar(.hidden, for: .windowToolbar)
            }
        }
        // The root's own. Pushing a screen makes SwiftUI put its back chevron in
        // a window toolbar, and the toolbar takes a strip of the window to hold
        // it — a grey band above a page whose backdrop is meant to run to the
        // top edge, on a window that asked for no titlebar in the first place.
        // Hiding it and drawing the chevron ourselves gives the artwork the
        // whole window back.
        .toolbar(.hidden, for: .windowToolbar)
        .background(Palette.background)
        // Both of these float *over* the screen rather than taking a strip of
        // it, so a hero runs full-bleed underneath. Every screen that isn't led
        // by artwork starts `Metric.navClearance` down instead.
        .overlay(alignment: .top) {
            NavPill(
                destination: destination,
                select: go,
                back: path.isEmpty ? nil : { path.removeLast() }
            )
        }
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
