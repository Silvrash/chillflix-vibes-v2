import SwiftUI

/// Search across movies and shows at once, the way the web app does — one grid,
/// most popular first, rather than two lists the user has to reconcile.
struct SearchView: View {
    @State private var query = ""
    @State private var results: [(item: MediaItem, type: MediaType)] = []
    @State private var searching = false

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 16)]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TextField("Search movies and shows", text: $query)
                .textFieldStyle(.roundedBorder)
                .font(.title3)
                .padding(28)

            if searching && results.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if query.trimmingCharacters(in: .whitespaces).count < 2 {
                hint("Type at least two letters to search.")
            } else if results.isEmpty {
                hint("No results for “\(query)”.")
            } else {
                ScrollView {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 18) {
                        ForEach(results, id: \.item.id) { result in
                            NavigationLink(value: Route.detail(result.type, result.item.id)) {
                                PosterCard(item: result.item)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(28)
                }
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

    private func hint(_ message: String) -> some View {
        Text(message)
            .foregroundStyle(Palette.muted)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
