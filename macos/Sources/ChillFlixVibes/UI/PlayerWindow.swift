import SwiftUI
import WebKit

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

/// Playback.
///
/// The stream providers are embed pages rather than direct video URLs, so the
/// film plays in a WKWebView pointed at the site's chrome-less `/embed` route —
/// the same page the TV app loads. Keeping every client on that one route means
/// a change to the player lineup reaches all of them without shipping an app.
///
/// Unlike Android, there is no engine problem to work around here: WKWebView is
/// current Safari, and a Mac has a pointer, so the player's own controls are
/// directly usable.
struct PlayerWindow: View {
    let target: PlaybackTarget

    private var type: MediaType { target.type }
    private var id: Int { target.id }
    private var title: String { target.title }
    private var season: Int { target.season }
    private var episode: Int { target.episode }
    private var isAnime: Bool { target.isAnime }
    @State private var picked: PlayerChoice?
    @State private var anilistId: Int?
    @State private var resolved = false

    private var choices: [PlayerChoice] { players(for: type, isAnime: isAnime) }

    /// The lineup's own first player until the viewer picks another. Not a
    /// constant, because the lineups no longer agree on what leads them: anime
    /// opens on vidnest and everything else on vidlink, and naming either one
    /// here would open the other kind of title on the wrong provider.
    private var player: PlayerChoice { picked ?? choices[0] }

    var body: some View {
        Group {
            if resolved {
                WebPlayer(url: embedURL(type: type, id: id, season: season, episode: episode,
                                        player: player.id, anilistId: anilistId))
                // The URL is part of the identity: switching player or episode
                // has to reload the frame, not reuse the old one.
                .id("\(player.id)-\(season)-\(episode)")
            } else {
                LoadingIndicator()
            }
        }
        // The nav pill floats over this screen too, as it does over the web app's
        // watch page, so the picture starts below it rather than under it.
        .padding(.top, Metric.navClearance)
        .ignoresSafeArea(edges: .top)
        // Both plates ride in the pill's own band rather than in a row beneath
        // it, which is the whole point of them: that band is empty either side
        // of a centred pill, and a strip of its own cost the picture 44pt of a
        // window whose content is a fixed-ratio rectangle.
        .overlay(alignment: .top) { transportBar.ignoresSafeArea(edges: .top) }
        .frame(minWidth: 900, minHeight: 560)
        .background(Palette.background)
        .navigationTitle(title)
        .task {
            // Anime resolves to a different provider, so hold the load until
            // the AniList lookup settles rather than briefly loading the wrong
            // player and reloading a moment later.
            if isAnime { anilistId = await TmdbClient.shared.anilistId(id) }
            resolved = true

            // Remember where we got to. Position within the episode still
            // belongs to the provider — this records the episode itself.
            WatchStore.shared.record(
                WatchEntry(
                    id: id, type: type.rawValue, title: title,
                    posterPath: target.posterPath, backdropPath: target.backdropPath,
                    season: season, episode: episode
                )
            )
        }
    }

    /// What is playing on the left, which player is serving it on the right —
    /// two glass plates in the band the nav pill floats in, one either side of it.
    ///
    /// They are plates rather than a bar across the window because the pill is
    /// centred in that band and cannot be moved: anything spanning the width
    /// would run underneath it. So each side is given exactly the room the pill
    /// leaves it and nothing more, and both plates give way rather than overlap
    /// — the title truncates, and the lineup falls back to a menu. Without that
    /// the layout is fine on a wide window and broken on a narrow one, which is
    /// the kind of thing that only shows up on someone else's screen.
    private var transportBar: some View {
        GeometryReader { geo in
            let side = max(0, (geo.size.width - Metric.navPillWidth) / 2)

            HStack(spacing: 0) {
                titlePlate
                    .frame(maxWidth: max(0, side - Metric.trafficLightInset - 12), alignment: .leading)
                Spacer(minLength: 0)
                lineupPlate(room: max(0, side - 26))
            }
            .padding(.leading, Metric.trafficLightInset)
            .padding(.trailing, 14)
            .padding(.top, 14)
        }
        // Sized to the band, or the geometry reader would claim the whole window
        // and swallow every click meant for the picture underneath.
        .frame(height: 58)
    }

    /// The title, and the episode when there is one.
    private var titlePlate: some View {
        HStack(spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .truncationMode(.tail)

            if type == .tv {
                Text("S\(season) · E\(episode)")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Palette.muted)
                    .fixedSize()
            }
        }
        .padding(.horizontal, 14)
        .frame(height: 44)
        .glass(radius: Metric.panelRadius, fill: Color.black.opacity(0.45))
    }

    /// The lineup: chips while they fit, a menu when they do not.
    ///
    /// Chips are the point — the whole lineup readable at a glance, and one
    /// click to change it, which is what a row of three earns over a menu. But
    /// three of them need about 230pt, and a narrow window does not have it to
    /// spare beside the pill. `ViewThatFits` picks between them off the room
    /// actually available rather than off a width guessed here.
    private func lineupPlate(room: CGFloat) -> some View {
        ViewThatFits(in: .horizontal) {
            chipRow
            lineupMenu
        }
        .frame(maxWidth: room, alignment: .trailing)
        .fixedSize(horizontal: false, vertical: true)
    }

    /// Not a segmented control: that fills its selection with the system accent,
    /// and no chrome in this app is coloured.
    private var chipRow: some View {
        HStack(spacing: 6) {
            ForEach(choices) { choice in
                Button(shortLabel(choice)) { picked = choice }
                    .buttonStyle(ChipButtonStyle(selected: choice == player))
                    .help(choice.label)
            }
        }
        .padding(6)
        .frame(height: 44)
        .fixedSize()
        .glass(radius: Metric.panelRadius, fill: Color.black.opacity(0.45))
    }

    private var lineupMenu: some View {
        Menu {
            ForEach(choices) { choice in
                Button(choice.label) { picked = choice }
            }
        } label: {
            HStack(spacing: 6) {
                Text(shortLabel(player))
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(.white)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(Palette.muted)
            }
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .padding(.horizontal, 14)
        .frame(height: 44)
        .fixedSize()
        .glass(radius: Metric.panelRadius, fill: Color.black.opacity(0.45))
        .help("Player")
    }

    /// "Main Player" reads as "Main" here. Trimmed rather than renamed at the
    /// source: the lineup's labels are shared with the site and the other
    /// clients, and this is the one surface short of room for them.
    private func shortLabel(_ choice: PlayerChoice) -> String {
        guard choice.label.hasSuffix(" Player") else { return choice.label }
        return String(choice.label.dropLast(" Player".count))
    }
}

private struct WebPlayer: NSViewRepresentable {
    let url: URL

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Lets the player's own fullscreen button work, on top of the window's.
        config.preferences.isElementFullscreenEnabled = true
        // Playback should start without a click; on the web the page is built
        // to autoplay.
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsAirPlayForMediaPlayback = true
        let view = WKWebView(frame: .zero, configuration: config)
        view.setValue(false, forKey: "drawsBackground")
        view.load(URLRequest(url: url))
        return view
    }

    func updateNSView(_ view: WKWebView, context: Context) {
        if view.url != url { view.load(URLRequest(url: url)) }
    }
}
