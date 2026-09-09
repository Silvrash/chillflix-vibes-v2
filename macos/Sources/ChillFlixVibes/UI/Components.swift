import SwiftUI

/// Shape and rhythm in one place, so every surface in the app agrees.
///
/// The radii are the web app's `rounded-xl` and `rounded-2xl`; the gutter is its
/// page inset, in points.
enum Metric {
    static let cardRadius: CGFloat = 12
    static let panelRadius: CGFloat = 16
    static let posterWidth: CGFloat = 158
    static let railGap: CGFloat = 16
    static let gutter: CGFloat = 32
    /// The air between one shelf and the next. Sections are told apart by the
    /// space around them rather than by rules or panels.
    static let sectionGap: CGFloat = 40
    /// How far down a screen starts when it must clear the floating nav pill.
    ///
    /// Measured from the top of the *window*, which is why every screen ignores
    /// the top safe area: the window asked for no titlebar, but SwiftUI still
    /// reserves one, and a screen that keeps the inset is pushed down twice.
    ///
    /// The pill ends at 58 — 14 top inset, 6 padding, a 32 brand mark, 6 padding
    /// — and the back chevron at 44, so 84 clears both with room to breathe.
    /// Change the pill and this moves with it. Screens led by artwork skip it on
    /// purpose: there the picture is meant to run underneath.
    static let navClearance: CGFloat = 84

    /// How wide the nav pill is, measured — the room down the middle of the top
    /// band that nothing else may occupy.
    ///
    /// The pill is centred and cannot be moved, so a screen putting its own
    /// controls in that band has to know what it is working around: the halves
    /// either side are all it has. Measured off the built app rather than
    /// derived, because the pill's width is the sum of five labels in a system
    /// font and no arithmetic here would survive a font change any better.
    /// Generous by a few points on purpose, and like `navClearance` it moves
    /// when the pill does.
    static let navPillWidth: CGFloat = 660

    /// How far in the traffic lights reach. `.hiddenTitleBar` leaves them
    /// floating in the corner and the app cannot move them, so anything drawn
    /// top-left starts past this.
    static let trafficLightInset: CGFloat = 92
}

/// How tall a hero runs, given the window it is in.
///
/// Shared by the home page and a title's detail page, which had drifted to two
/// formulas — the detail hero ran taller on the same window, so moving between
/// them shifted everything below by the difference. Tall enough to be the thing
/// you look at, short enough that the row beneath it still shows, which is what
/// says the page keeps going.
func heroHeight(for available: CGFloat) -> CGFloat {
    min(560, max(360, available * 0.66))
}

/// A translucent fill behind a hairline — the surface the web app floats over
/// artwork, for anything that has to stay legible while the poster behind it
/// changes.
///
/// The material is what makes it read as glass rather than as a flat plate:
/// AppKit blurs what is behind it, which a fill alone cannot do. `blurred` turns
/// that off for the badges scattered across a grid, where dozens of live blurs
/// cost real frames and nobody is reading through a pill 20 points tall.
struct GlassSurface: ViewModifier {
    var radius: CGFloat
    var fill: Color
    var border: Color = Palette.hairline
    var blurred: Bool = true

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return content
            .background(fill, in: shape)
            .background(blurred ? AnyShapeStyle(.ultraThinMaterial) : AnyShapeStyle(.clear), in: shape)
            .overlay(shape.strokeBorder(border, lineWidth: 1))
    }
}

extension View {
    func glass(
        radius: CGFloat,
        fill: Color = Palette.glass,
        border: Color = Palette.hairline,
        blurred: Bool = true
    ) -> some View {
        modifier(GlassSurface(radius: radius, fill: fill, border: border, blurred: blurred))
    }
}

/// The primary action: solid white, black label. Never a filled accent colour —
/// on a page whose only colour is the artwork, a blue button is the loudest
/// thing on the screen and it is never the thing worth looking at.
struct SolidButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { Content(configuration: configuration) }

    private struct Content: View {
        let configuration: ButtonStyleConfiguration
        @State private var hovering = false

        var body: some View {
            configuration.label
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(.black)
                .padding(.horizontal, 20)
                .padding(.vertical, 11)
                .background(
                    Color.white.opacity(configuration.isPressed ? 0.78 : hovering ? 0.88 : 1),
                    in: RoundedRectangle(cornerRadius: Metric.cardRadius, style: .continuous)
                )
                .onHover { hovering = $0 }
                .animation(.easeOut(duration: 0.12), value: hovering)
        }
    }
}

/// The secondary action beside it: the same size in glass.
struct GlassButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { Content(configuration: configuration) }

    private struct Content: View {
        let configuration: ButtonStyleConfiguration
        @State private var hovering = false

        var body: some View {
            configuration.label
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 20)
                .padding(.vertical, 11)
                .glass(
                    radius: Metric.cardRadius,
                    fill: configuration.isPressed ? Color.white.opacity(0.22) : hovering ? Palette.glassHover : Palette.glass,
                    border: hovering ? Palette.hairlineBright : Palette.hairline
                )
                .onHover { hovering = $0 }
                .animation(.easeOut(duration: 0.12), value: hovering)
        }
    }
}

/// One of a row of choices — a season, a player. Selected is the same solid
/// white the primary action uses, so "what you are looking at" is stated the
/// same way everywhere.
struct ChipButtonStyle: ButtonStyle {
    var selected: Bool

    func makeBody(configuration: Configuration) -> some View {
        Content(configuration: configuration, selected: selected)
    }

    private struct Content: View {
        let configuration: ButtonStyleConfiguration
        let selected: Bool
        @State private var hovering = false

        var body: some View {
            let shape = RoundedRectangle(cornerRadius: Metric.cardRadius, style: .continuous)
            configuration.label
                .font(.system(size: 12.5, weight: .medium))
                .foregroundStyle(selected ? .black : Palette.accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    selected
                        ? Color.white.opacity(configuration.isPressed ? 0.85 : 1)
                        : Color.white.opacity(configuration.isPressed ? 0.16 : hovering ? 0.10 : 0.05),
                    in: shape
                )
                .overlay(shape.strokeBorder(selected ? .clear : Palette.hairline, lineWidth: 1))
                .onHover { hovering = $0 }
                .animation(.easeOut(duration: 0.12), value: hovering)
        }
    }
}

/// A symbol and a word, at the gap the web app's buttons hold between them.
/// `Label` is the platform-idiomatic pairing but sets its own spacing from the
/// text style, which drifts away from the rest of the app's controls.
struct ActionLabel: View {
    let symbol: String
    let title: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: symbol).font(.system(size: 12, weight: .semibold))
            Text(title)
        }
    }
}

/// A shelf's name. One clear step above the card titles under it, which is all
/// the separation a section needs.
struct SectionHeading: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.system(size: 21, weight: .bold))
            .tracking(-0.3)
            .foregroundStyle(.white)
    }
}

/// The score, in a dark pill in the corner of the artwork. The star is the one
/// coloured thing the chrome is allowed.
struct RatingBadge: View {
    let value: Double

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "star.fill")
                .font(.system(size: 8.5))
                .foregroundStyle(Palette.rating)
            Text(String(format: "%.1f", value))
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .glass(radius: 20, fill: Palette.scrim, blurred: false)
    }
}

/// A poster, its title beneath it, and a muted "year · type" line under that —
/// the same card the web app's grids and rails are built from.
///
/// Hover lifts and brightens the ring, which is the pointer's version of the
/// focus ring the TV app draws. Only the artwork moves: the title staying put is
/// what keeps a whole rail from jittering as the pointer crosses it.
struct PosterCard: View {
    let item: MediaItem
    /// Named so the meta line can say "Movie" or "TV". Rails know this from the
    /// list they drew the item out of; nothing on the item itself says it.
    var type: MediaType?
    var width: CGFloat = Metric.posterWidth

    @State private var hovering = false

    private var meta: String {
        [item.year, type.map { $0 == .movie ? "Movie" : "TV" }]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            artwork

            Text(item.displayTitle)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white)
                .lineLimit(1)
                .padding(.top, 10)

            if !meta.isEmpty {
                Text(meta)
                    .font(.system(size: 11))
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
                    .padding(.top, 2)
            }
        }
        .frame(width: width, alignment: .leading)
        .onHover { hovering = $0 }
    }

    private var artwork: some View {
        let shape = RoundedRectangle(cornerRadius: Metric.cardRadius, style: .continuous)
        return ZStack(alignment: .topTrailing) {
            Palette.surfaceLight
            AsyncImage(url: TmdbImage.url(item.posterPath)) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                // A title with no artwork is still a title worth reading.
                Text(item.displayTitle)
                    .font(.system(size: 11))
                    .foregroundStyle(Palette.muted)
                    .multilineTextAlignment(.center)
                    .padding(10)
            }
            if item.voteAverage > 0 {
                RatingBadge(value: item.voteAverage).padding(7)
            }
        }
        .frame(width: width, height: width * 1.5)
        .clipShape(shape)
        .overlay(shape.strokeBorder(hovering ? Palette.hairlineBright : Palette.hairline, lineWidth: 1))
        .scaleEffect(hovering ? 1.03 : 1)
        .animation(.easeOut(duration: 0.16), value: hovering)
    }
}

/// Cast, in the same poster shape the web app gives people. A headshot cropped
/// to a circle throws away most of the frame, and a row of circles reads as a
/// different kind of thing from the rows above and below it.
struct PersonCard: View {
    let member: CastMember
    var width: CGFloat = 116

    @State private var hovering = false

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Metric.cardRadius, style: .continuous)
        return VStack(alignment: .leading, spacing: 0) {
            AsyncImage(url: TmdbImage.url(member.profilePath, size: "w185")) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Palette.surfaceLight.overlay(
                    Image(systemName: "person.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(Palette.muted.opacity(0.5))
                )
            }
            .frame(width: width, height: width * 1.5)
            .clipShape(shape)
            .overlay(shape.strokeBorder(hovering ? Palette.hairlineBright : Palette.hairline, lineWidth: 1))
            .scaleEffect(hovering ? 1.03 : 1)
            .animation(.easeOut(duration: 0.16), value: hovering)

            Text(member.name)
                .font(.system(size: 12.5, weight: .medium))
                .foregroundStyle(.white)
                .lineLimit(1)
                .padding(.top, 10)

            if !member.character.isEmpty {
                Text(member.character)
                    .font(.system(size: 11))
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
                    .padding(.top, 2)
            }
        }
        .frame(width: width, alignment: .leading)
        .onHover { hovering = $0 }
    }
}

/// A horizontally scrolling shelf, the same shape as the web app's rails.
struct MediaShelf: View {
    let title: String
    let items: [MediaItem]
    let fallback: MediaType

    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeading(title: title)
                    .padding(.horizontal, Metric.gutter)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: Metric.railGap) {
                        ForEach(items) { item in
                            NavigationLink(value: Route.detail(item.mediaType(fallback: fallback), item.id)) {
                                PosterCard(item: item, type: item.mediaType(fallback: fallback))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, Metric.gutter)
                    // Hover lifts a card past its own bounds; without this the
                    // scroll view clips the top and bottom off the ring.
                    .padding(.vertical, 6)
                }
            }
        }
    }
}

/// A shelf that has not arrived yet, drawn at the size of the one that will.
///
/// The blocks breathe rather than sitting there as dead grey boxes, so a slow
/// row reads as loading rather than as a hole in the page.
struct ShelfPlaceholder: View {
    let title: String
    @State private var dim = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeading(title: title)
                .padding(.horizontal, Metric.gutter)

            HStack(alignment: .top, spacing: Metric.railGap) {
                ForEach(0..<7, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 0) {
                        RoundedRectangle(cornerRadius: Metric.cardRadius, style: .continuous)
                            .fill(Palette.surfaceLight)
                            .frame(width: Metric.posterWidth, height: Metric.posterWidth * 1.5)
                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                            .fill(Palette.surfaceLight)
                            .frame(width: Metric.posterWidth * 0.78, height: 11)
                            .padding(.top, 12)
                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                            .fill(Palette.surfaceLight)
                            .frame(width: Metric.posterWidth * 0.38, height: 9)
                            .padding(.top, 6)
                    }
                }
            }
            .padding(.horizontal, Metric.gutter)
            .padding(.vertical, 6)
            .opacity(dim ? 0.45 : 0.9)
            .animation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true), value: dim)
            .onAppear { dim = true }
        }
    }
}

/// Loads a shelf only when it appears, so opening the app doesn't fire twenty
/// requests at once.
///
/// The placeholder is load-bearing, not decoration: an empty shelf renders
/// nothing, so every unloaded shelf would collapse to zero height, stack at the
/// same point in the lazy column, and never be materialised — meaning `.task`
/// never runs and the shelf never loads. Occupying a loaded shelf's height is
/// what makes the lazy stack page through them properly.
struct PresetShelf: View {
    let preset: Preset
    @State private var items: [MediaItem] = []
    @State private var loaded = false

    var body: some View {
        Group {
            if items.isEmpty && !loaded {
                ShelfPlaceholder(title: preset.name)
            } else {
                MediaShelf(title: preset.name, items: items, fallback: preset.type)
            }
        }
        .task {
            guard !loaded else { return }
            items = (try? await TmdbClient.shared.discover(preset.type, filters: preset.filters).results) ?? []
            loaded = true
        }
    }
}

/// The centred spinner every screen shows while its first request is in flight.
struct LoadingIndicator: View {
    var body: some View {
        ProgressView()
            .controlSize(.large)
            .tint(Palette.muted)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// An empty or failed state: a symbol and a line of muted copy, held in the
/// middle of whatever space it was given.
struct EmptyStateView: View {
    let symbol: String
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 26, weight: .light))
                .foregroundStyle(Palette.muted.opacity(0.55))
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Palette.muted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Metric.gutter)
    }
}

/// The title of a screen that leads with controls rather than with artwork.
/// With the titlebar hidden there is nowhere else for a screen to say its name.
struct PageHeading: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.system(size: 30, weight: .bold))
            .tracking(-0.6)
            .foregroundStyle(.white)
    }
}

/// Pins a scroll view to macOS's *overlay* scrollers.
///
/// macOS picks the scroller style from the pointing device, not from the app:
/// plug in a mouse and every scroll view switches to "legacy" scrollers — a
/// full-width track with a pale knob, holding real layout width for as long as
/// the view exists. On a dark, full-bleed page that reads as a bright bar down
/// the edge of the artwork, and it is the one piece of chrome the palette cannot
/// reach, because the track is drawn by AppKit rather than by us.
///
/// Overlay scrollers float above the content instead, take no width, fade out
/// when the scrolling stops, and are what a trackpad already gets. The knob is
/// forced light because AppKit picks its contrast from the scroll view's own
/// backing, which here is the page's near-black ground.
///
/// The work is deferred a runloop turn: SwiftUI has not attached the
/// representable to its enclosing NSScrollView yet while `updateNSView` runs, so
/// reading `enclosingScrollView` any earlier finds nothing.
private struct OverlayScrollers: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView { NSView(frame: .zero) }

    func updateNSView(_ view: NSView, context: Context) {
        DispatchQueue.main.async {
            guard let scrollView = view.enclosingScrollView else { return }
            scrollView.scrollerStyle = .overlay
            scrollView.verticalScroller?.knobStyle = .light
            scrollView.horizontalScroller?.knobStyle = .light
        }
    }
}

extension View {
    /// Apply to the *content* of a ScrollView or List, not to the view itself:
    /// the helper finds its scroll view by looking up the view tree.
    func overlayScrollers() -> some View {
        background(OverlayScrollers().frame(width: 0, height: 0))
    }
}
