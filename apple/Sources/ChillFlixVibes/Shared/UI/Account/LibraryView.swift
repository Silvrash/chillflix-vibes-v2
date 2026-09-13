import SwiftUI

/// A signed-in collection, in the shape of a browse page: heading, count,
/// then the grid every other list of titles in the app uses.
///
/// Three states, and they say different things. Not signed in is not the same
/// as an empty collection, and neither is the same as still loading — a fourth
/// screen spelling that distinction slightly differently is how it quietly
/// stops being made, which is why `AccountPage` carries it for all of them.
struct LibraryView: View {
    let kind: LibraryKind

    @EnvironmentObject private var account: AccountStore
    @State private var items: [MediaItem] = []
    @State private var loaded = false

    var body: some View {
        AccountPage(title: kind.title, blurb: kind.blurb, count: loaded ? items.count : nil, loaded: loaded, items: items,
                    emptySymbol: kind.symbol, emptyMessage: kind.emptyMessage,
                    signedOutMessage: "Sign in with TMDB to keep a watchlist that follows you between your browser, your TV and your Mac.")
            .task(id: account.revision) { await load() }
    }

    private func load() async {
        guard let profile = account.profile else { return }
        loaded = false
        async let films = AccountClient.shared.collection(kind, .movie, accountId: profile.accountId)
        async let series = AccountClient.shared.collection(kind, .tv, accountId: profile.accountId)
        let (movies, shows) = ((try? await films)?.results ?? [], (try? await series)?.results ?? [])
        items = interleave(movies.stamped(.movie), shows.stamped(.tv))
        loaded = true
    }
}

/// The whole of what TMDB suggests, where the home shelf shows only its head.
struct RecommendationsView: View {
    @EnvironmentObject private var account: AccountStore
    @State private var items: [MediaItem] = []
    @State private var loaded = false

    var body: some View {
        AccountPage(
            title: "Recommended for you",
            blurb: "Built by TMDB from the titles you have rated and favourited. The more you mark, the closer these get.",
            count: loaded ? items.count : nil, loaded: loaded, items: items,
            emptySymbol: "sparkles",
            emptyMessage: "Rate or favourite a few films and series, and TMDB will start suggesting things here. It can take a while to catch up after you do.",
            signedOutMessage: "Sign in with TMDB and rate or favourite a few titles — these suggestions are built from your own account rather than from this device."
        )
        .task(id: account.revision) { await load() }
    }

    private func load() async {
        guard let profile = account.profile else { return }
        loaded = false
        async let films = AccountClient.shared.recommendations(.movie, objectId: profile.accountObjectId)
        async let series = AccountClient.shared.recommendations(.tv, objectId: profile.accountObjectId)
        let (movies, shows) = ((try? await films)?.results ?? [], (try? await series)?.results ?? [])
        items = interleave(movies.stamped(.movie), shows.stamped(.tv))
        loaded = true
    }
}

/// The chrome every account page wears, and the three states behind it.
struct AccountPage: View {
    let title: String
    let blurb: String
    var count: Int?
    var countNoun = "title"
    let loaded: Bool
    let items: [MediaItem]
    let emptySymbol: String
    let emptyMessage: String
    let signedOutMessage: String

    @EnvironmentObject private var account: AccountStore

    private let columns = [GridItem(.adaptive(minimum: Metric.posterWidth), spacing: Metric.railGap)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                AccountPageHeading(title: title, blurb: blurb, count: count, countNoun: countNoun)

                if !account.ready {
                    EmptyView()
                } else if !account.isSignedIn {
                    SignedOutNotice(message: signedOutMessage)
                } else if !loaded {
                    LoadingIndicator().frame(maxWidth: .infinity, minHeight: 240)
                } else if items.isEmpty {
                    EmptyStateView(symbol: emptySymbol, message: emptyMessage)
                        .frame(minHeight: 240)
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: Metric.railGap + 8) {
                        ForEach(items) { item in
                            NavigationLink(value: Route.detail(item.mediaType(fallback: .movie), item.id)) {
                                PosterCard(item: item, type: item.mediaType(fallback: .movie))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, Metric.gutter)
                    .padding(.top, 28)
                }
            }
            .padding(.top, Metric.navClearance)
            .padding(.bottom, 36)
            .overlayScrollers()
        }
        .ignoresSafeArea(edges: .top)
        .background(Palette.background)
        .navigationTitle(title)
    }
}

struct AccountPageHeading: View {
    let title: String
    let blurb: String
    var count: Int?
    var countNoun = "title"

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                PageHeading(title: title)
                if let count {
                    Text("\(count) \(count == 1 ? countNoun : countNoun + "s")")
                        .font(.system(size: 11.5, weight: .medium))
                        .foregroundStyle(Palette.muted)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .glass(radius: 999)
                }
            }
            Text(blurb)
                .font(.system(size: 13.5))
                .foregroundStyle(Palette.muted)
                .frame(maxWidth: 640, alignment: .leading)
        }
        .padding(.horizontal, Metric.gutter)
    }
}

/// What a signed-out viewer sees on a page that is only about them.
struct SignedOutNotice: View {
    let message: String
    @EnvironmentObject private var account: AccountStore

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Palette.muted)
                .frame(maxWidth: 560, alignment: .leading)
            Button {
                Task { await account.signIn() }
            } label: {
                ActionLabel(symbol: "person.crop.circle", title: "Sign in with TMDB")
            }
            .buttonStyle(SolidButtonStyle())
            .disabled(account.busy)
        }
        .padding(28)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.surface.opacity(0.6), in: RoundedRectangle(cornerRadius: Metric.panelRadius, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Metric.panelRadius, style: .continuous).stroke(Palette.hairline))
        .padding(.horizontal, Metric.gutter)
        .padding(.top, 28)
    }
}
