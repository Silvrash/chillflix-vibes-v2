import SwiftUI
import WebKit

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
    let type: MediaType
    let id: Int
    let title: String
    var season: Int = 1
    var episode: Int = 1
    var isAnime: Bool = false
    var posterPath: String?
    var backdropPath: String?

    @Environment(\.dismiss) private var dismiss
    @State private var player = playerMain
    @State private var anilistId: Int?
    @State private var resolved = false

    private var choices: [PlayerChoice] { players(for: type, isAnime: isAnime) }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text(title).font(.headline).lineLimit(1)
                if type == .tv {
                    Text("S\(season) · E\(episode)").font(.subheadline).foregroundStyle(Palette.accent)
                }
                Spacer()
                Picker("", selection: $player) {
                    ForEach(choices) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .frame(width: 320)
                Button("Done") { dismiss() }
            }
            .padding(12)
            .background(Palette.surface)

            if resolved {
                WebPlayer(url: embedURL(type: type, id: id, season: season, episode: episode,
                                        player: player.id, anilistId: anilistId))
                // The URL is part of the identity: switching player or episode
                // has to reload the frame, not reuse the old one.
                .id("\(player.id)-\(season)-\(episode)")
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(minWidth: 900, minHeight: 560)
        .background(Palette.background)
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
                    posterPath: posterPath, backdropPath: backdropPath,
                    season: season, episode: episode
                )
            )
        }
    }
}

private struct WebPlayer: NSViewRepresentable {
    let url: URL

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
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
