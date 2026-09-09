import SwiftUI

@main
struct ChillFlixVibesApp: App {
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
                switch route {
                case let .detail(type, id): DetailView(type: type, id: id)
                case let .play(target): PlayerWindow(target: target)
                }
            }
        }
        .background(Palette.background)
        // The pill floats *over* the screen rather than taking a strip of it, so
        // a hero runs full-bleed underneath. Every screen that isn't led by
        // artwork starts `Metric.navClearance` down instead.
        .overlay(alignment: .top) { NavPill(destination: destination, select: go) }
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
private struct NavPill: View {
    let destination: Destination
    let select: (Destination) -> Void

    var body: some View {
        HStack(spacing: 6) {
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
                    Image(systemName: "film.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                )
        }
        .buttonStyle(.plain)
        .help("ChillFlixVibes home")
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
