import SwiftUI

struct DetailView: View {
    let type: MediaType
    let id: Int

    @State private var details: MediaDetails?
    @State private var recommendations: [MediaItem] = []
    @State private var episodes: [Episode] = []
    @State private var season = 1
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        ScrollView {
            if let details {
                VStack(alignment: .leading, spacing: 22) {
                    header(details)

                    if type == .tv, !details.airedSeasons.isEmpty {
                        seasonPicker(details)
                        episodeStrip
                    }

                    if let cast = details.credits?.cast, !cast.isEmpty {
                        castRow(cast)
                    }

                    MediaShelf(title: "More Like This", items: recommendations, fallback: type)
                    Spacer(minLength: 30)
                }
            } else {
                ProgressView().padding(80).frame(maxWidth: .infinity)
            }
        }
        .background(Palette.background)
        .navigationTitle(details?.displayTitle ?? "")
        .task {
            details = try? await TmdbClient.shared.details(type, id: id)
            recommendations = (try? await TmdbClient.shared.recommendations(type, id: id)) ?? []
        }
        .task(id: season) {
            guard type == .tv else { return }
            episodes = (try? await TmdbClient.shared.season(tvId: id, number: season))?.episodes ?? []
        }
    }

    private func header(_ details: MediaDetails) -> some View {
        ZStack(alignment: .bottomLeading) {
            AsyncImage(url: TmdbImage.url(details.backdropPath, size: "w1280")) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: { Rectangle().fill(Palette.surfaceLight) }
                .frame(height: 400)
                .clipped()

            LinearGradient(colors: [Palette.background, Palette.background.opacity(0.5), .clear],
                           startPoint: .leading, endPoint: .trailing)
            LinearGradient(colors: [.clear, Palette.background.opacity(0.9), Palette.background],
                           startPoint: .center, endPoint: .bottom)

            VStack(alignment: .leading, spacing: 10) {
                Text(details.displayTitle).font(.system(size: 34, weight: .bold))
                Text(meta(details)).font(.callout).foregroundStyle(Palette.accent)
                if !details.overview.isEmpty {
                    Text(details.overview)
                        .font(.callout).foregroundStyle(Palette.muted)
                        .lineLimit(3).frame(maxWidth: 620, alignment: .leading)
                }
                Button {
                    let last = WatchStore.shared.lastWatched(type, id)
                    play(season: last.season, episode: last.episode)
                } label: {
                    Label(resumeLabel, systemImage: "play.fill")
                        .padding(.horizontal, 8).padding(.vertical, 4)
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(28)
        }
        .frame(height: 400)
    }

    private func play(season: Int, episode: Int) {
        openWindow(id: "player", value: PlaybackTarget(
            type: type, id: id, title: details?.displayTitle ?? "",
            season: season, episode: episode, isAnime: details?.isAnime ?? false,
            posterPath: details?.posterPath, backdropPath: details?.backdropPath
        ))
    }

    /// "Resume S2 · E4" when they've started it before, "Play" otherwise.
    private var resumeLabel: String {
        let last = WatchStore.shared.lastWatched(type, id)
        let started = WatchStore.shared.continueWatching.contains { $0.id == id && $0.type == type.rawValue }
        if type != .tv { return started ? "Resume" : "Play" }
        return started ? "Resume S\(last.season) · E\(last.episode)" : "Play S1 · E1"
    }

    private func meta(_ details: MediaDetails) -> String {
        var parts: [String] = []
        if details.voteAverage > 0 { parts.append(String(format: "★ %.1f", details.voteAverage)) }
        if let year = details.year { parts.append(year) }
        if let runtime = details.runtimeMinutes { parts.append("\(runtime) min") }
        if details.numberOfSeasons > 0 {
            parts.append("\(details.numberOfSeasons) Season\(details.numberOfSeasons > 1 ? "s" : "")")
        }
        let genres = details.genres.prefix(3).map(\.name).joined(separator: " · ")
        if !genres.isEmpty { parts.append(genres) }
        return parts.joined(separator: "  ·  ")
    }

    private func seasonPicker(_ details: MediaDetails) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(details.airedSeasons) { item in
                    Button("Season \(item.seasonNumber)") { season = item.seasonNumber }
                        .buttonStyle(.bordered)
                        .tint(item.seasonNumber == season ? Palette.primary : Palette.surface)
                }
            }
            .padding(.horizontal, 28)
        }
    }

    private var episodeStrip: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Episodes").font(.title3.weight(.semibold)).padding(.horizontal, 28)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 14) {
                    ForEach(episodes) { episode in
                        Button {
                            play(season: season, episode: episode.episodeNumber)
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                AsyncImage(url: TmdbImage.url(episode.stillPath, size: "w300")) { image in
                                    image.resizable().aspectRatio(contentMode: .fill)
                                } placeholder: { Rectangle().fill(Palette.surfaceLight) }
                                    .frame(width: 220, height: 124)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                Text("E\(episode.episodeNumber) · \(episode.name)")
                                    .font(.caption).lineLimit(1).foregroundStyle(.white)
                            }
                            .frame(width: 220, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 28)
            }
        }
    }

    private func castRow(_ cast: [CastMember]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Cast").font(.title3.weight(.semibold)).padding(.horizontal, 28)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 18) {
                    ForEach(cast.prefix(20)) { member in
                        VStack(spacing: 6) {
                            AsyncImage(url: TmdbImage.url(member.profilePath, size: "w185")) { image in
                                image.resizable().aspectRatio(contentMode: .fill)
                            } placeholder: { Circle().fill(Palette.surfaceLight) }
                                .frame(width: 76, height: 76)
                                .clipShape(Circle())
                            Text(member.name).font(.caption).lineLimit(1)
                            Text(member.character).font(.caption2).foregroundStyle(Palette.muted).lineLimit(1)
                        }
                        .frame(width: 100)
                    }
                }
                .padding(.horizontal, 28)
            }
        }
    }
}

