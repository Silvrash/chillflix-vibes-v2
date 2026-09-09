import SwiftUI

/// Search across movies and shows at once, the way the web app does — one grid,
/// most popular first, rather than two lists the user has to reconcile.
struct SearchView: View {
    @State private var query = ""
    @State private var results: [(item: MediaItem, type: MediaType)] = []
    @State private var searching = false
    @FocusState private var typing: Bool

    private let columns = [GridItem(.adaptive(minimum: Metric.posterWidth), spacing: Metric.railGap)]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            if searching && results.isEmpty {
                LoadingIndicator()
            } else if query.trimmingCharacters(in: .whitespaces).count < 2 {
                EmptyStateView(symbol: "magnifyingglass", message: "Type at least two letters to search.")
            } else if results.isEmpty {
                EmptyStateView(symbol: "questionmark.circle", message: "No results for “\(query)”.")
            } else {
                ScrollView {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 26) {
                        ForEach(results, id: \.item.id) { result in
                            NavigationLink(value: Route.detail(result.type, result.item.id)) {
                                PosterCard(item: result.item, type: result.type)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, Metric.gutter)
                    .padding(.vertical, 10)
                }
                .overlayScrollers()
            }
        }
        .background(Palette.background)
        .navigationTitle("Search")
        .task(id: query) {
            let trimmed = query.trimmingCharacters(in: .whitespaces)
            guard trimmed.count >= 2 else { results = []; return }
            // Debounce: a new keystroke cancels this task before the sleep ends.
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }

            searching = true
            async let movies = TmdbClient.shared.search(.movie, query: trimmed)
            async let shows = TmdbClient.shared.search(.tv, query: trimmed)
            let merged = ((try? await movies.results) ?? []).map { ($0, MediaType.movie) }
                + ((try? await shows.results) ?? []).map { ($0, MediaType.tv) }
            results = merged
                .filter { $0.0.posterPath != nil }
                .sorted { $0.0.popularity > $1.0.popularity }
                .map { (item: $0.0, type: $0.1) }
            searching = false
        }
    }

    /// The field is glass with the symbol inside it rather than a bordered form
    /// control: this screen is one question, and a system text field frames it
    /// as data entry.
    private var header: some View {
        VStack(alignment: .leading, spacing: 16) {
            PageHeading(title: "Search")

            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Palette.muted)
                TextField("Movies and shows", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 15))
                    .foregroundStyle(.white)
                    .focused($typing)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .glass(radius: Metric.cardRadius, fill: Color.white.opacity(0.06))
            .frame(maxWidth: 560)
        }
        .padding(.horizontal, Metric.gutter)
        .padding(.top, Metric.navClearance)
        .padding(.bottom, 18)
        // Landing on Search means wanting to type; a Mac app should not ask for
        // a click first.
        .onAppear { typing = true }
    }
}
