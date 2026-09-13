import SwiftUI
import WebKit

/// Playback on a phone or a tablet.
///
/// The same chrome-less `/embed` page the Mac and the TV load, in a web view
/// that fills whatever is left once the navigation bar has said what is
/// playing. The lineup lives in that bar too, behind a menu, because a phone
/// has no band beside a pill to lay three chips in.
///
/// The tab bar goes: nothing about playback needs it, and the screen it would
/// take is the picture's.
struct PlayerScreen: View {
    let target: PlaybackTarget

    @State private var picked: PlayerChoice?
    @State private var anilistId: Int?
    @State private var resolved = false

    private var choices: [PlayerChoice] { players(for: target.type, isAnime: target.isAnime) }
    private var player: PlayerChoice { picked ?? choices[0] }

    var body: some View {
        Group {
            if resolved {
                EmbedWebView(url: embedURL(
                    type: target.type, id: target.id, season: target.season, episode: target.episode,
                    player: player.id, anilistId: anilistId
                ))
                // The URL is part of the identity: switching player has to
                // reload the frame, not reuse the old one.
                .id("\(player.id)-\(target.season)-\(target.episode)")
                .ignoresSafeArea(edges: .bottom)
            } else {
                LoadingIndicator()
            }
        }
        .background(Color.black)
        .navigationTitle(target.type == .tv ? "\(target.title) · S\(target.season) E\(target.episode)" : target.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.black, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ForEach(choices) { choice in
                        Button {
                            picked = choice
                        } label: {
                            if choice == player {
                                Label(choice.label, systemImage: "checkmark")
                            } else {
                                Text(choice.label)
                            }
                        }
                    }
                } label: {
                    Label("Player", systemImage: "rectangle.on.rectangle")
                }
            }
        }
        .task {
            // Anime resolves to a different provider, so hold the load until
            // the AniList lookup settles rather than briefly loading the wrong
            // player and reloading a moment later.
            if target.isAnime { anilistId = await TmdbClient.shared.anilistId(target.id) }
            resolved = true

            WatchStore.shared.record(
                WatchEntry(
                    id: target.id, type: target.type.rawValue, title: target.title,
                    posterPath: target.posterPath, backdropPath: target.backdropPath,
                    season: target.season, episode: target.episode
                )
            )
        }
    }
}

private struct EmbedWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Inline, not the system's full-screen video controller: the embed
        // page draws its own controls, and popping every play into AVPlayer
        // would hide them. Its own fullscreen button still works.
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsAirPlayForMediaPlayback = true
        config.allowsPictureInPictureMediaPlayback = true
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = .black
        view.scrollView.isScrollEnabled = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.load(URLRequest(url: url))
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        if view.url != url { view.load(URLRequest(url: url)) }
    }
}
