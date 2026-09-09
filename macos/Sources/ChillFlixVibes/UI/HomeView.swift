import SwiftUI

struct HomeView: View {
    @State private var trending: [MediaItem] = []
    @State private var failed = false
    @ObservedObject private var watched = WatchStore.shared

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Metric.sectionGap) {
                    hero(height: heroHeight(for: proxy.size.height))

                    if !watched.continueWatching.isEmpty {
                        MediaShelf(
                            title: "Continue Watching",
                            items: watched.continueWatching.map(\.asMediaItem),
                            fallback: .tv
                        )
                    }
                    NetworkRow()
                    MediaShelf(title: "Trending Today", items: trending, fallback: .movie)
                    ForEach(homeShelves) { PresetShelf(preset: $0) }

                    attribution
                }
                .padding(.bottom, 36)
                .overlayScrollers()
            }
            // The hero runs to the very top of the window — under the nav pill
            // and the traffic lights — rather than starting below a strip of
            // empty ground. Its copy sits at the bottom, clear of both.
            .ignoresSafeArea(edges: .top)
        }
        .background(Palette.background)
        .navigationTitle("Home")
        .task {
            do { trending = try await TmdbClient.shared.trending() } catch { failed = true }
        }
    }

    @ViewBuilder private func hero(height: CGFloat) -> some View {
        if let item = trending.first {
            HeroBanner(item: item, height: height)
        } else if failed {
            EmptyStateView(
                symbol: "wifi.exclamationmark",
                message: "Couldn't reach ChillFlixVibes. Check your connection."
            )
            .frame(height: height)
        } else {
            LoadingIndicator().frame(height: height)
        }
    }

    /// Every title, still and rating in the app comes from TMDB, and their terms
    /// ask that it be said. The web app's footer carries the same line.
    private var attribution: some View {
        VStack(alignment: .leading, spacing: 14) {
            Rectangle()
                .fill(Palette.hairline)
                .frame(height: 1)
            Text(
                "Titles, artwork, ratings and episode data come from The Movie Database (TMDB). "
                    + "This product uses the TMDB API but is not endorsed or certified by TMDB."
            )
            .font(.system(size: 11))
            .foregroundStyle(Palette.muted)
            .frame(maxWidth: 620, alignment: .leading)
        }
        .padding(.horizontal, Metric.gutter)
        .padding(.top, 4)
    }
}

/// The row of network tiles, mirroring the web home page's.
///
/// It shows no titles, so it needs no fetch — the twelve brands are static, and
/// each tile pushes a browse screen already filtered to that network.
private struct NetworkRow: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeading(title: "TV Shows by Network")
                .padding(.horizontal, Metric.gutter)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Metric.railGap) {
                    ForEach(networks, id: \.self) { network in
                        NavigationLink(value: Route.network(network)) {
                            NetworkTile(network: network)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Metric.gutter)
                // Room for the focus ring, which the scroller would otherwise clip.
                .padding(.vertical, 4)
            }
        }
    }
}

/// One tile: the logo centred on a neutral plate.
///
/// Painted white rather than left as TMDB serves it, which is the same
/// correction the web app makes: the files are transparent PNGs carrying one
/// flat brand colour each, and half this set — HBO Max, Apple TV+, Peacock,
/// AMC, FX, Adult Swim — is pure black, invisible on a plate this dark. No one
/// plate colour carries the set either: light enough for the black wordmarks and
/// the bright ones disappear instead.
private struct NetworkTile: View {
    let network: NetworkFilter

    @State private var hovering = false

    var body: some View {
        AsyncImage(url: TmdbImage.url(network.logoPath, size: "w300")) { image in
            image
                .resizable()
                .aspectRatio(contentMode: .fit)
                .colorMultiply(.black)
                .colorInvert()
        } placeholder: {
            Text(network.name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .frame(width: 168, height: 94)
        .background(Palette.surface, in: RoundedRectangle(cornerRadius: Metric.cardRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Metric.cardRadius, style: .continuous)
                .stroke(hovering ? Palette.hairlineBright : Palette.hairline, lineWidth: 1)
        )
        .scaleEffect(hovering ? 1.03 : 1)
        .onHover { hovering = $0 }
        .animation(.easeOut(duration: 0.14), value: hovering)
        .accessibilityLabel(network.name)
    }
}

/// Full-bleed artwork with the copy over a scrim — the same hero the web and TV
/// apps lead with.
struct HeroBanner: View {
    let item: MediaItem
    var height: CGFloat = 440

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
            // Two scrims, not one: the vertical carries the copy block, the
            // horizontal keeps the left third dark whatever the artwork does
            // there, and together they land the picture on the page's own ground
            // rather than cutting it off at an edge.
            LinearGradient(
                stops: [
                    .init(color: Palette.background, location: 0),
                    .init(color: Palette.background.opacity(0.75), location: 0.38),
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

            copy
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .background {
            AsyncImage(url: TmdbImage.url(item.backdropPath, size: "w1280")) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Palette.surfaceLight
            }
        }
        .clipped()
    }

    private var copy: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(item.displayTitle)
                .font(.system(size: 46, weight: .heavy))
                .tracking(-1.4)
                .foregroundStyle(.white)
                .lineLimit(2)
                .shadow(color: .black.opacity(0.45), radius: 12, y: 3)

            HStack(spacing: 14) {
                if let year = item.year {
                    Text(year)
                }
                if item.voteAverage > 0 {
                    HStack(spacing: 5) {
                        Image(systemName: "star.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(Palette.rating)
                        Text(String(format: "%.1f", item.voteAverage))
                    }
                }
            }
            .font(.system(size: 13))
            .foregroundStyle(Palette.accent)
            .padding(.top, 10)

            if !item.overview.isEmpty {
                Text(item.overview)
                    .font(.system(size: 13.5))
                    .foregroundStyle(.white.opacity(0.8))
                    .lineSpacing(2)
                    .lineLimit(3)
                    .frame(maxWidth: 580, alignment: .leading)
                    .padding(.top, 12)
            }

            HStack(spacing: 12) {
                NavigationLink(value: playTarget) {
                    ActionLabel(symbol: "play.fill", title: "Watch now")
                }
                .buttonStyle(SolidButtonStyle())

                NavigationLink(value: Route.detail(item.mediaType(fallback: .movie), item.id)) {
                    ActionLabel(symbol: "info.circle", title: "More info")
                }
                .buttonStyle(GlassButtonStyle())
            }
            .padding(.top, 22)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Metric.gutter)
        .padding(.bottom, 36)
    }
}

/// A browse screen: the category rail on the left, the poster grid beside it —
/// the shape the web app's /movies, /tv and /anime pages hold.
struct BrowseView: View {
    let section: BrowseSection
    /// Set when a network tile opened this screen, so it arrives already
    /// filtered rather than on the section's default category.
    var initialNetwork: NetworkFilter?

    /// nil until the viewer picks something, so the screen opens on the
    /// section's first category without duplicating it in two places.
    @State private var chosen: BrowseSelection?
    @State private var items: [MediaItem] = []
    @State private var loading = true
    @State private var page = 1
    @State private var totalPages = 1

    private var selection: BrowseSelection {
        chosen
            ?? BrowseSelection(
                preset: section.presets[0],
                genres: ownedGenres(section.presets[0]),
                network: initialNetwork
            )
    }

    private let columns = [GridItem(.adaptive(minimum: Metric.posterWidth), spacing: Metric.railGap)]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            header

            HStack(alignment: .top, spacing: 26) {
                BrowseSidebar(section: section, selection: selection, select: { chosen = $0 })
                    .frame(width: 210)
                    .padding(.leading, Metric.gutter)

                grid
            }
        }
        // Same as the home page: the window asked for no titlebar, so the safe
        // area it still reserves at the top is dead space above a heading that
        // is already inset to clear the pill.
        .ignoresSafeArea(edges: .top)
        .background(Palette.background)
        .navigationTitle(section.label)
        .task(id: selection) {
            page = 1
            items = []
            await loadPage()
        }
        .task(id: page) {
            guard page > 1 else { return }
            await loadPage()
        }
    }

    /// The name of the screen and a line saying what is in it, above both
    /// columns rather than beside the grid — the rail's own headings read as
    /// parts of the page, not as things the page is subordinate to.
    private var header: some View {
        VStack(alignment: .leading, spacing: 5) {
            PageHeading(title: section.label)
            Text(subtitle)
                .font(.system(size: 13))
                .foregroundStyle(Palette.muted)
        }
        .padding(.horizontal, Metric.gutter)
        .padding(.top, Metric.navClearance)
    }

    private var subtitle: String {
        switch section {
        case .movies: "Browse the film catalogue by category, genre and era."
        case .tv: "Browse the series catalogue by category, genre and era."
        // Not "series": this section's categories include anime films.
        case .anime: "Browse Japanese animation by category, genre and era."
        }
    }

    @ViewBuilder private var grid: some View {
        if loading && items.isEmpty {
            LoadingIndicator()
        } else if items.isEmpty {
            EmptyStateView(symbol: "film", message: "No titles match these filters.")
        } else {
            ScrollView {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 26) {
                    ForEach(items) { item in
                        NavigationLink(value: Route.detail(item.mediaType(fallback: selection.preset.type), item.id)) {
                            PosterCard(item: item, type: item.mediaType(fallback: selection.preset.type))
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
                // Hover lifts a card past its own bounds, and the scroll view
                // clips: without the inset the ring is shaved off the edge cards.
                .padding(.horizontal, 4)
                .padding(.vertical, 4)
                .padding(.trailing, Metric.gutter)
                .padding(.bottom, 36)
                .overlayScrollers()
            }
        }
    }

    private func loadPage() async {
        loading = true
        if let response = try? await TmdbClient.shared.discover(selection.preset.type, filters: selection.filters, page: page) {
            // De-dupe: TMDB repeats titles across pages when sorting by
            // popularity, and duplicate ids break a ForEach.
            let seen = Set(items.map(\.id))
            items += response.results.filter { !seen.contains($0.id) }
            totalPages = response.totalPages
        }
        loading = false
    }
}

/// What the browse screen is asking TMDB for: a category, the genres ticked on
/// top of it, and — on series — a network. One value, so a change to any part of
/// it restarts the same load.
struct BrowseSelection: Hashable {
    var preset: Preset
    var genres: Set<Int>
    var network: NetworkFilter?

    /// The category's own filters with the ticked genres and network folded in.
    ///
    /// The genre set *is* the `with_genres` filter, not an addition to it: a
    /// category's own genres are put into the set the moment it is picked, so
    /// unticking one takes it out of the query too. That is what lets "Horror
    /// Movies for the Brave" be narrowed rather than only swapped away from.
    var filters: [String: String] {
        var filters = preset.filters
        filters["with_genres"] = genres.isEmpty ? nil : genres.sorted().map(String.init).joined(separator: ",")
        if let network { filters["with_networks"] = network.ids }
        return filters
    }
}

/// The genres a category brings with it, as opposed to the ones the viewer added.
private func ownedGenres(_ preset: Preset) -> Set<Int> {
    Set((preset.filters["with_genres"] ?? "").split(separator: ",").compactMap { Int($0) })
}

/// The persistent left column of a browse screen: curated categories, then
/// genres, then — on the series screen — networks.
///
/// It owns no state. Every row writes a whole new `BrowseSelection` back to the
/// screen and reads its own lit-or-not out of the one it was handed, so the rail
/// and the grid can never tell different stories.
private struct BrowseSidebar: View {
    let section: BrowseSection
    let selection: BrowseSelection
    let select: (BrowseSelection) -> Void

    /// A real `List` in AppKit's sidebar style rather than a stack of painted
    /// rows: that is what supplies the vibrancy behind it, the standard row
    /// metrics and insets, the system selection highlight, and the disclosure
    /// behaviour a Mac user already knows. The web app draws its own because a
    /// browser has nothing to inherit; here there is, so inherit it.
    ///
    /// The category is a `List` selection because exactly one runs at a time,
    /// which is what a sidebar selection means. Genres and networks are
    /// checkboxes instead — several can be on at once, and a checkbox is how
    /// macOS says so. Rows without a `tag` cannot be selected, so the two
    /// behaviours share one list without fighting over it.
    var body: some View {
        List(selection: categoryChoice) {
            Section("Categories") {
                ForEach(section.presets) { preset in
                    Text(categoryLabel(preset.name)).tag(preset)
                }
            }

            Section("Genres") {
                ForEach(genreOptions, id: \.id) { genre in
                    Toggle(genre.name, isOn: genreChoice(genre.id)).toggleStyle(.checkbox)
                }
            }

            if section == .tv {
                Section("Networks") {
                    ForEach(networks, id: \.self) { network in
                        Toggle(network.name, isOn: networkChoice(network)).toggleStyle(.checkbox)
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .overlayScrollers()
    }

    /// Writing `nil` would mean "no category", which this screen has no state
    /// for — a click on the row that is already selected is a no-op rather than
    /// a deselection.
    private var categoryChoice: Binding<Preset?> {
        Binding(
            get: { section.presets.first(where: isActive) },
            set: { if let preset = $0 { pick(preset) } }
        )
    }

    private func genreChoice(_ id: Int) -> Binding<Bool> {
        Binding(get: { selection.genres.contains(id) }, set: { _ in toggle(id) })
    }

    private func networkChoice(_ network: NetworkFilter) -> Binding<Bool> {
        Binding(get: { selection.network == network }, set: { _ in toggle(network) })
    }

    /// Lit while the category is the one running *and* every genre it brought
    /// with it is still ticked — untick one and the rows say so, the way the web
    /// app's rail does.
    private func isActive(_ preset: Preset) -> Bool {
        preset == selection.preset && ownedGenres(preset).isSubset(of: selection.genres)
    }

    /// Genre 16 is in every anime category's own filters, so a row for it would
    /// arrive lit and, unticked, would take the viewer out of the section.
    private var genreOptions: [Genre] {
        let all = genres(for: selection.preset.type)
        return section == .anime ? all.filter { $0.id != 16 } : all
    }

    /// A category decides the sort, the era and the rating floor; the genres and
    /// the network are a lens laid over whichever one is running, so they survive
    /// the swap. Genres the new category's media type doesn't have cannot: TMDB
    /// files films and series under two different genre lists.
    private func pick(_ preset: Preset) {
        let picked = selection.genres.subtracting(ownedGenres(selection.preset))
        let offered = Set(genres(for: preset.type).map(\.id))
        select(BrowseSelection(
            preset: preset,
            genres: ownedGenres(preset).union(picked.intersection(offered)),
            network: selection.network
        ))
    }

    private func toggle(_ id: Int) {
        var next = selection
        if next.genres.contains(id) { next.genres.remove(id) } else { next.genres.insert(id) }
        select(next)
    }

    /// One network at a time, and picking the lit one again clears it: the
    /// question this section answers is "what is on Netflix", and two networks at
    /// once would answer nothing — TMDB's `with_networks` ANDs them, and no series
    /// is on two.
    private func toggle(_ network: NetworkFilter) {
        var next = selection
        next.network = next.network == network ? nil : network
        select(next)
    }
}

/// Categories are named as prose ("Recommended Movies", "Epic Sci-Fi TV Shows"),
/// and the rail is already inside one section — so that tail is noise on every
/// row of it.
private func categoryLabel(_ name: String) -> String {
    for tail in [" Movies", " TV Shows", " on TV"] where name.hasSuffix(tail) {
        return String(name.dropLast(tail.count))
    }
    return name
}

/// TMDB's two genre lists, spelled out rather than fetched: the app's data layer
/// offers no genre endpoint, and these lists change about once a decade. Read
/// from the site's own `/api/tmdb/genre/{movie,tv}/list`.
private func genres(for type: MediaType) -> [Genre] {
    type == .movie ? movieGenres : tvGenres
}

private let movieGenres: [Genre] = [
    Genre(id: 28, name: "Action"),
    Genre(id: 12, name: "Adventure"),
    Genre(id: 16, name: "Animation"),
    Genre(id: 35, name: "Comedy"),
    Genre(id: 80, name: "Crime"),
    Genre(id: 99, name: "Documentary"),
    Genre(id: 18, name: "Drama"),
    Genre(id: 10751, name: "Family"),
    Genre(id: 14, name: "Fantasy"),
    Genre(id: 36, name: "History"),
    Genre(id: 27, name: "Horror"),
    Genre(id: 10402, name: "Music"),
    Genre(id: 9648, name: "Mystery"),
    Genre(id: 10749, name: "Romance"),
    Genre(id: 878, name: "Science Fiction"),
    Genre(id: 10770, name: "TV Movie"),
    Genre(id: 53, name: "Thriller"),
    Genre(id: 10752, name: "War"),
    Genre(id: 37, name: "Western"),
]

private let tvGenres: [Genre] = [
    Genre(id: 10759, name: "Action & Adventure"),
    Genre(id: 16, name: "Animation"),
    Genre(id: 35, name: "Comedy"),
    Genre(id: 80, name: "Crime"),
    Genre(id: 99, name: "Documentary"),
    Genre(id: 18, name: "Drama"),
    Genre(id: 10751, name: "Family"),
    Genre(id: 10762, name: "Kids"),
    Genre(id: 9648, name: "Mystery"),
    Genre(id: 10763, name: "News"),
    Genre(id: 10764, name: "Reality"),
    Genre(id: 10765, name: "Sci-Fi & Fantasy"),
    Genre(id: 10766, name: "Soap"),
    Genre(id: 10767, name: "Talk"),
    Genre(id: 10768, name: "War & Politics"),
    Genre(id: 37, name: "Western"),
]

/// A network row and the `with_networks` value behind it. The ids are pipe-
/// joined — TMDB's own OR — so a brand it still files under two of them (HBO and
/// HBO Max, Paramount+ and the CBS All Access it grew out of) reads as one row.
///
/// The list is `lib/networks.ts` without the logos, which a 210pt column has no
/// room to render legibly. It is offered on the series screen alone because
/// `with_networks` is a TV-only parameter: sent to /discover/movie, TMDB does
/// not reject it, it answers with the entire unfiltered film catalogue.
struct NetworkFilter: Hashable {
    let name: String
    let ids: String
    /// TMDB's own logo file. Mirrors `lib/networks.ts` on the web, so the two
    /// rows of tiles are the same twelve brands drawn from the same artwork.
    let logoPath: String
}

let networks: [NetworkFilter] = [
    NetworkFilter(name: "Netflix", ids: "213", logoPath: "/wwemzKWzjKYJFfCeiB57q3r4Bcm.png"),
    NetworkFilter(name: "Prime Video", ids: "1024", logoPath: "/w7HfLNm9CWwRmAMU58udl2L7We7.png"),
    NetworkFilter(name: "Disney+", ids: "2739", logoPath: "/1edZOYAfoyZyZ3rklNSiUpXX30Q.png"),
    NetworkFilter(name: "HBO Max", ids: "49|3186", logoPath: "/nmU0UMDJB3dRRQSTUqawzF2Od1a.png"),
    NetworkFilter(name: "Apple TV+", ids: "2552", logoPath: "/bngHRFi794mnMq34gfVcm9nDxN1.png"),
    NetworkFilter(name: "Hulu", ids: "453", logoPath: "/pqUTCleNUiTLAVlelGxUgWn1ELh.png"),
    NetworkFilter(name: "Paramount+", ids: "4330|1709", logoPath: "/fi83B1oztoS47xxcemFdPMhIzK.png"),
    NetworkFilter(name: "Peacock", ids: "3353", logoPath: "/gIAcGTjKKr0KOHL5s4O36roJ8p7.png"),
    NetworkFilter(name: "AMC", ids: "174", logoPath: "/pmvRmATOCaDykE6JrVoeYxlFHw3.png"),
    NetworkFilter(name: "FX", ids: "88", logoPath: "/aexGjtcs42DgRtZh7zOxayiry4J.png"),
    NetworkFilter(name: "BBC One", ids: "4", logoPath: "/uJjcCg3O4DMEjM0xtno9OWFciRP.png"),
    NetworkFilter(name: "Adult Swim", ids: "80", logoPath: "/tHZPHOLc6iF27G34cAZGPsMtMSy.png"),
]
