import SwiftUI

struct DetailView: View {
    let type: MediaType
    let id: Int

    @State private var details: MediaDetails?
    @State private var recommendations: [MediaItem] = []
    @State private var episodes: [Episode] = []
    @State private var season = 1

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                if let details {
                    LazyVStack(alignment: .leading, spacing: Metric.sectionGap) {
                        header(details, height: heroHeight(for: proxy.size.height))

                        if type == .tv, !details.airedSeasons.isEmpty {
                            episodesSection(details)
                        }

                        if let cast = details.credits?.cast, !cast.isEmpty {
                            castRow(cast)
                        }

                        MediaShelf(title: "Recommended", items: recommendations, fallback: type)
                    }
                    .padding(.bottom, 36)
                } else {
                    LoadingIndicator().frame(height: proxy.size.height)
                }
            }
            .overlayScrollers()
            // The backdrop runs to the top edge of the window, with the back
            // chevron floating over it the way the web app's Back pill does.
            .ignoresSafeArea(edges: .top)
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

    private func header(_ details: MediaDetails, height: CGFloat) -> some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                stops: [
                    .init(color: Palette.background, location: 0),
                    .init(color: Palette.background.opacity(0.78), location: 0.42),
                    .init(color: .clear, location: 1),
                ],
                startPoint: .bottom, endPoint: .top
            )
            LinearGradient(
                stops: [
                    .init(color: Palette.background, location: 0),
                    .init(color: Palette.background.opacity(0.5), location: 0.4),
                    .init(color: .clear, location: 1),
                ],
                startPoint: .leading, endPoint: .trailing
            )

            HStack(alignment: .bottom, spacing: 26) {
                poster(details)
                copy(details)
            }
            .padding(.horizontal, Metric.gutter)
            .padding(.bottom, 34)
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .background {
            AsyncImage(url: TmdbImage.url(details.backdropPath, size: "w1280")) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Palette.surfaceLight
            }
        }
        .clipped()
        // The nav pill and the window's own back chevron both float up here over
        // the artwork; without a scrim they land on whatever the top of the
        // backdrop happens to be.
        .overlay(alignment: .top) {
            LinearGradient(colors: [.black.opacity(0.55), .clear], startPoint: .top, endPoint: .bottom)
                .frame(height: 120)
                .allowsHitTesting(false)
        }
    }

    private func poster(_ details: MediaDetails) -> some View {
        let shape = RoundedRectangle(cornerRadius: Metric.panelRadius, style: .continuous)
        return AsyncImage(url: TmdbImage.url(details.posterPath, size: "w500")) { image in
            image.resizable().aspectRatio(contentMode: .fill)
        } placeholder: {
            Palette.surfaceLight
        }
        .frame(width: 152, height: 228)
        .clipShape(shape)
        .overlay(shape.strokeBorder(Palette.hairline, lineWidth: 1))
    }

    private func copy(_ details: MediaDetails) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(details.displayTitle)
                .font(.system(size: 42, weight: .heavy))
                .tracking(-1.2)
                .foregroundStyle(.white)
                .lineLimit(2)
                .shadow(color: .black.opacity(0.45), radius: 12, y: 3)

            metaRow(details)
                .padding(.top, 12)

            if !details.genres.isEmpty {
                HStack(spacing: 8) {
                    ForEach(details.genres.prefix(4), id: \.id) { genre in
                        Text(genre.name)
                            .font(.system(size: 11.5, weight: .medium))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 5)
                            .glass(radius: Metric.cardRadius)
                    }
                }
                .padding(.top, 14)
            }

            if !details.overview.isEmpty {
                Text(details.overview)
                    .font(.system(size: 13.5))
                    .foregroundStyle(.white.opacity(0.8))
                    .lineSpacing(2)
                    .lineLimit(3)
                    .frame(maxWidth: 640, alignment: .leading)
                    .padding(.top, 14)
            }

            NavigationLink(value: target(season: resumePoint.season, episode: resumePoint.episode)) {
                ActionLabel(symbol: "play.fill", title: resumeLabel)
            }
            .buttonStyle(SolidButtonStyle())
            .padding(.top, 22)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Rating, release, runtime and season count, each behind its own symbol —
    /// four separate facts rather than one long dot-separated string.
    private func metaRow(_ details: MediaDetails) -> some View {
        HStack(spacing: 18) {
            if details.voteAverage > 0 {
                fact("star.fill", String(format: "%.1f", details.voteAverage), tint: Palette.rating)
            }
            if let year = details.year {
                fact("calendar", year)
            }
            if let runtime = details.runtimeMinutes {
                fact("clock", "\(runtime) min")
            }
            if details.numberOfSeasons > 0 {
                fact("rectangle.stack", "\(details.numberOfSeasons) Season\(details.numberOfSeasons > 1 ? "s" : "")")
            }
        }
        .font(.system(size: 13))
        .foregroundStyle(Palette.accent)
    }

    private func fact(_ symbol: String, _ text: String, tint: Color? = nil) -> some View {
        HStack(spacing: 6) {
            Image(systemName: symbol)
                .font(.system(size: 11))
                .foregroundStyle(tint ?? Palette.accent)
            Text(text)
        }
    }

    private var resumePoint: (season: Int, episode: Int) { WatchStore.shared.lastWatched(type, id) }

    private func target(season: Int, episode: Int) -> Route {
        .play(PlaybackTarget(
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

    private func episodesSection(_ details: MediaDetails) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeading(title: "Episodes")
                .padding(.horizontal, Metric.gutter)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(details.airedSeasons) { item in
                        Button("Season \(item.seasonNumber)") { season = item.seasonNumber }
                            .buttonStyle(ChipButtonStyle(selected: item.seasonNumber == season))
                    }
                }
                .padding(.horizontal, Metric.gutter)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: Metric.railGap) {
                    ForEach(episodes) { episode in
                        NavigationLink(value: target(season: season, episode: episode.episodeNumber)) {
                            EpisodeCard(episode: episode)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Metric.gutter)
                .padding(.vertical, 4)
            }
        }
    }

    private func castRow(_ cast: [CastMember]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeading(title: "Cast")
                .padding(.horizontal, Metric.gutter)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: Metric.railGap) {
                    ForEach(cast.prefix(20)) { member in
                        PersonCard(member: member)
                    }
                }
                .padding(.horizontal, Metric.gutter)
                .padding(.vertical, 6)
            }
        }
    }
}

/// One episode, in the glass panel the web app gives them: still, number and
/// name, then as much of the synopsis as two lines will carry.
///
/// The panel is a fixed size so a row of them shares one baseline — episode
/// synopses run from one line to a paragraph, and left to themselves the cards
/// would step up and down across the row.
private struct EpisodeCard: View {
    let episode: Episode
    @State private var hovering = false

    private static let width: CGFloat = 236
    private static let inset: CGFloat = 10

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Metric.panelRadius, style: .continuous)
        let stillWidth = Self.width - Self.inset * 2
        return VStack(alignment: .leading, spacing: 0) {
            AsyncImage(url: TmdbImage.url(episode.stillPath, size: "w300")) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Palette.surfaceLight.overlay(
                    Text("E\(episode.episodeNumber)")
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.muted)
                )
            }
            .frame(width: stillWidth, height: stillWidth * 9 / 16)
            .clipShape(RoundedRectangle(cornerRadius: Metric.cardRadius, style: .continuous))

            Text("E\(episode.episodeNumber) · \(episode.name)")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .padding(.top, 10)

            Text(episode.overview)
                .font(.system(size: 11))
                .foregroundStyle(.white.opacity(0.7))
                .lineSpacing(1)
                .lineLimit(2)
                .frame(height: 28, alignment: .top)
                .padding(.top, 4)
        }
        .frame(width: stillWidth, alignment: .leading)
        .padding(Self.inset)
        .background(Color.white.opacity(hovering ? 0.07 : 0.03), in: shape)
        .overlay(shape.strokeBorder(hovering ? Palette.hairlineBright : Palette.hairline, lineWidth: 1))
        .onHover { hovering = $0 }
        .animation(.easeOut(duration: 0.14), value: hovering)
    }
}
