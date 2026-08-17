import SwiftUI

/// A poster with its title underneath. Hover lifts it, which is the pointer
/// equivalent of the focus ring the TV app draws.
struct PosterCard: View {
    let item: MediaItem
    var width: CGFloat = 150
    @State private var hovering = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack {
                Rectangle().fill(Palette.surfaceLight)
                AsyncImage(url: TmdbImage.url(item.posterPath)) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Text(item.displayTitle)
                        .font(.caption)
                        .foregroundStyle(Palette.muted)
                        .padding(6)
                        .multilineTextAlignment(.center)
                }
            }
            .frame(width: width, height: width * 1.5)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(hovering ? Palette.primary : .clear, lineWidth: 2)
            )
            .scaleEffect(hovering ? 1.04 : 1)
            .animation(.easeOut(duration: 0.14), value: hovering)

            Text(item.displayTitle)
                .font(.caption)
                .lineLimit(1)
                .foregroundStyle(hovering ? .white : Palette.muted)
            if let year = item.year {
                Text(year).font(.caption2).foregroundStyle(Palette.muted.opacity(0.8))
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
            VStack(alignment: .leading, spacing: 8) {
                Text(title).font(.title3.weight(.semibold))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 14) {
                        ForEach(items) { item in
                            NavigationLink(value: Route.detail(item.mediaType(fallback: fallback), item.id)) {
                                PosterCard(item: item)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .padding(.horizontal, 28)
        }
    }
}

/// Loads a shelf only when it appears, so opening the app doesn't fire twenty
/// requests at once.
///
/// The placeholder is load-bearing, not decoration: an empty shelf renders
/// nothing, so every unloaded shelf would collapse to zero height, stack at the
/// same point in the lazy column, and never be materialised — meaning `.task`
/// never runs and the shelf never loads. Occupying its eventual height is what
/// makes the lazy stack page through them properly.
struct PresetShelf: View {
    let preset: Preset
    @State private var items: [MediaItem] = []
    @State private var loaded = false

    var body: some View {
        Group {
            if items.isEmpty && !loaded {
                VStack(alignment: .leading, spacing: 8) {
                    Text(preset.name).font(.title3.weight(.semibold))
                    HStack(spacing: 14) {
                        ForEach(0..<6, id: \.self) { _ in
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Palette.surfaceLight)
                                .frame(width: 150, height: 225)
                        }
                    }
                }
                .padding(.horizontal, 28)
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
