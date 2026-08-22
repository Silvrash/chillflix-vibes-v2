import SwiftUI

struct HomeView: View {
    @State private var trending: [MediaItem] = []
    @State private var failed = false
    @ObservedObject private var watched = WatchStore.shared

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 22) {
                if let hero = trending.first {
                    HeroBanner(item: hero)
                } else if failed {
                    Text("Couldn't reach ChillFlixVibes. Check your connection.")
                        .foregroundStyle(Palette.muted)
                        .padding(28)
                } else {
                    ProgressView().padding(60).frame(maxWidth: .infinity)
                }

                if !watched.continueWatching.isEmpty {
                    MediaShelf(
                        title: "Continue Watching",
                        items: watched.continueWatching.map(\.asMediaItem),
                        fallback: .tv
                    )
                }
                MediaShelf(title: "Trending Today", items: trending, fallback: .movie)
                ForEach(homeShelves) { PresetShelf(preset: $0) }
                Spacer(minLength: 30)
            }
        }
        .background(Palette.background)
        .navigationTitle("Home")
        .task {
            do { trending = try await TmdbClient.shared.trending() } catch { failed = true }
        }
    }
}

/// Full-bleed artwork with the copy over a scrim — the same hero the web and TV
/// apps lead with.
struct HeroBanner: View {
    let item: MediaItem

    /// Resumes where they left off, if they've started this before.
    private var playTarget: Route {
        let type = item.mediaType(fallback: .movie)
        let last = WatchStore.shared.lastWatched(type, item.id)
        return .play(PlaybackTarget(
            type: type, id: item.id, title: item.displayTitle,
            season: last.season, episode: last.episode,
            posterPath: item.posterPath, backdropPath: item.backdropPath
        ))
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            AsyncImage(url: TmdbImage.url(item.backdropPath, size: "w1280")) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Rectangle().fill(Palette.surfaceLight)
            }
            .frame(height: 380)
            .clipped()

            LinearGradient(
                colors: [Palette.background, Palette.background.opacity(0.5), .clear],
                startPoint: .leading, endPoint: .trailing
            )
            LinearGradient(
                colors: [.clear, Palette.background.opacity(0.85), Palette.background],
                startPoint: .center, endPoint: .bottom
            )

            VStack(alignment: .leading, spacing: 10) {
                Text(item.displayTitle).font(.system(size: 38, weight: .bold))
                HStack(spacing: 10) {
                    if item.voteAverage > 0 {
                        Text(String(format: "★ %.1f", item.voteAverage))
                            .font(.callout.weight(.semibold))
                            .foregroundStyle(.yellow)
                    }
                    if let year = item.year { Text(year).foregroundStyle(Palette.accent) }
                }
                if !item.overview.isEmpty {
                    Text(item.overview)
                        .font(.callout)
                        .foregroundStyle(Palette.muted)
                        .lineLimit(2)
                        .frame(maxWidth: 560, alignment: .leading)
                }
                HStack(spacing: 10) {
                    NavigationLink(value: playTarget) {
                        Label("Play", systemImage: "play.fill").padding(.horizontal, 8).padding(.vertical, 4)
                    }
                    .buttonStyle(.borderedProminent)
                    NavigationLink(value: Route.detail(item.mediaType(fallback: .movie), item.id)) {
                        Text("Details").padding(.horizontal, 8).padding(.vertical, 4)
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(28)
        }
        .frame(height: 380)
    }
}

struct BrowseView: View {
    let section: BrowseSection
    @State private var selected: Preset?
    @State private var items: [MediaItem] = []
    @State private var loading = true
    @State private var page = 1
    @State private var totalPages = 1

    private var preset: Preset { selected ?? section.presets[0] }
    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 16)]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(section.presets) { item in
                        Button(item.name) { selected = item }
                            .buttonStyle(.bordered)
                            .tint(item == preset ? Palette.primary : Palette.surface)
                    }
                }
                .padding(.horizontal, 28)
                .padding(.vertical, 10)
            }

            if loading && items.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 18) {
                        ForEach(items) { item in
                            NavigationLink(value: Route.detail(item.mediaType(fallback: preset.type), item.id)) {
                                PosterCard(item: item)
                            }
                            .buttonStyle(.plain)
                            .onAppear {
                                // Fetch the next page as the tail comes into
                                // view, so scrolling never hits a dead stop.
                                if item.id == items.last?.id, page < totalPages, !loading {
                                    page += 1
                                }
                            }
                        }
                    }
                    .padding(28)
                }
            }
        }
        .background(Palette.background)
        .navigationTitle(section.label)
        .task(id: preset) {
            page = 1
            items = []
            await loadPage()
        }
        .task(id: page) {
            guard page > 1 else { return }
            await loadPage()
        }
    }

    private func loadPage() async {
        loading = true
        if let response = try? await TmdbClient.shared.discover(preset.type, filters: preset.filters, page: page) {
            // De-dupe: TMDB repeats titles across pages when sorting by
            // popularity, and duplicate ids break a ForEach.
            let seen = Set(items.map(\.id))
            items += response.results.filter { !seen.contains($0.id) }
            totalPages = response.totalPages
        }
        loading = false
    }
}
