import SwiftUI

/// The viewer's own lists, and a way to start one.
struct ListsView: View {
    @EnvironmentObject private var account: AccountStore
    @State private var lists: [ListSummary] = []
    @State private var loaded = false
    @State private var naming = false
    @State private var newName = ""

    private let columns = [GridItem(.adaptive(minimum: 220), spacing: Metric.railGap)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    AccountPageHeading(
                        title: "Your lists",
                        blurb: "Collections you keep on TMDB. New ones are private until you say otherwise.",
                        count: loaded ? lists.count : nil, countNoun: "list"
                    )
                    Spacer()
                    if account.isSignedIn {
                        Button {
                            newName = ""
                            naming = true
                        } label: {
                            ActionLabel(symbol: "plus", title: "New list")
                        }
                        .buttonStyle(GlassButtonStyle())
                        .padding(.trailing, Metric.gutter)
                    }
                }

                if !account.ready {
                    EmptyView()
                } else if !account.isSignedIn {
                    SignedOutNotice(message: "Sign in with TMDB to keep lists that follow you between your browser, your TV and your Mac.")
                } else if !loaded {
                    LoadingIndicator().frame(maxWidth: .infinity, minHeight: 240)
                } else if lists.isEmpty {
                    EmptyStateView(symbol: "text.badge.plus", message: "Make a list and add titles to it from their pages.")
                        .frame(minHeight: 240)
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: Metric.railGap) {
                        ForEach(lists) { list in
                            NavigationLink(value: Route.list(list.id)) { ListCard(list: list) }
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
        .belowTheChrome()
        .background(Palette.background)
        #if os(iOS)
        .navigationTitle("")
        .heroNavigationBar()
        #else
        .navigationTitle("Your lists")
        #endif
        .task(id: account.revision) { await load() }
        .alert("New list", isPresented: $naming) {
            TextField("Name", text: $newName)
            Button("Create") { Task { await create() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Lists are private unless you make them public on TMDB.")
        }
    }

    private func load() async {
        guard let profile = account.profile else { return }
        loaded = false
        do {
            lists = try await AccountClient.shared.lists(objectId: profile.accountObjectId).results
        } catch AccountError.signedOut {
            account.sessionRejected()
        } catch {}
        loaded = true
    }

    private func create() async {
        let name = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        do {
            _ = try await AccountClient.shared.createList(name: name)
            account.didChange()
        } catch AccountError.signedOut {
            account.sessionRejected()
        } catch {
            account.failure = "Couldn't create that list. Check your connection and try again."
        }
    }
}

/// A list as a landscape tile: its artwork, its name, how many it holds.
private struct ListCard: View {
    let list: ListSummary
    @State private var hovering = false

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            AsyncImage(url: TmdbImage.url(list.backdropPath ?? list.posterPath, size: "w780")) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Palette.surfaceLight
            }
            .frame(height: 124)
            .clipped()

            LinearGradient(colors: [.black.opacity(0.85), .clear], startPoint: .bottom, endPoint: .center)

            VStack(alignment: .leading, spacing: 3) {
                Text(list.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text("\(list.numberOfItems) \(list.numberOfItems == 1 ? "title" : "titles")")
                    if list.isPublic {
                        Text("·")
                        Text("Public")
                    }
                }
                .font(.system(size: 11.5))
                .foregroundStyle(Palette.muted)
            }
            .padding(12)
        }
        .frame(height: 124)
        .clipShape(RoundedRectangle(cornerRadius: Metric.cardRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Metric.cardRadius, style: .continuous)
                .stroke(hovering ? Palette.hairlineBright : Palette.hairline)
        )
        .scaleEffect(hovering ? 1.02 : 1)
        .onHover { hovering = $0 }
        .animation(.easeOut(duration: 0.15), value: hovering)
    }
}

/// One list: its titles, and the controls that change it.
struct ListDetailView: View {
    let id: Int

    @EnvironmentObject private var account: AccountStore
    @Environment(\.dismiss) private var dismiss
    @State private var list: ListDetails?
    @State private var loaded = false
    @State private var editing = false
    @State private var renaming = false
    @State private var confirmingDelete = false
    @State private var draftName = ""
    @State private var draftDescription = ""
    @State private var removing: Set<Int> = []

    private let columns = [GridItem(.adaptive(minimum: Metric.posterWidth), spacing: Metric.railGap)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    AccountPageHeading(
                        title: list?.name ?? "List",
                        blurb: list.map { $0.description.isEmpty ? "A list you keep on TMDB." : $0.description } ?? "",
                        count: list.map(\.itemCount)
                    )
                    Spacer()
                    if list != nil { controls.padding(.trailing, Metric.gutter) }
                }

                if !loaded {
                    LoadingIndicator().frame(maxWidth: .infinity, minHeight: 240)
                } else if let list, list.results.isEmpty {
                    EmptyStateView(symbol: "text.badge.plus", message: "Nothing on this list yet. Add titles from their pages.")
                        .frame(minHeight: 240)
                } else if let list {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: Metric.railGap + 8) {
                        ForEach(list.results) { item in
                            let type = item.mediaType(fallback: .movie)
                            ZStack(alignment: .topTrailing) {
                                NavigationLink(value: Route.detail(type, item.id)) {
                                    PosterCard(item: item, type: type)
                                }
                                .buttonStyle(.plain)
                                .disabled(editing)

                                if editing {
                                    Button {
                                        Task { await remove(item) }
                                    } label: {
                                        Image(systemName: "xmark")
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundStyle(.white)
                                            .frame(width: 28, height: 28)
                                            .background(Palette.scrim, in: Circle())
                                            .overlay(Circle().stroke(Palette.hairlineBright))
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(removing.contains(item.id))
                                    .padding(6)
                                    .help("Remove from list")
                                }
                            }
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
        .belowTheChrome()
        .background(Palette.background)
        #if os(iOS)
        .navigationTitle("")
        .heroNavigationBar()
        #else
        .navigationTitle(list?.name ?? "List")
        #endif
        .task(id: account.revision) { await load() }
        .alert("Rename list", isPresented: $renaming) {
            TextField("Name", text: $draftName)
            TextField("Description", text: $draftDescription)
            Button("Save") { Task { await rename() } }
            Button("Cancel", role: .cancel) {}
        }
        .confirmationDialog("Delete this list?", isPresented: $confirmingDelete, titleVisibility: .visible) {
            Button("Delete list", role: .destructive) { Task { await delete() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The titles stay on TMDB; only the list goes.")
        }
    }

    private var controls: some View {
        HStack(spacing: 8) {
            Button {
                editing.toggle()
            } label: {
                ActionLabel(symbol: editing ? "checkmark" : "minus.circle", title: editing ? "Done" : "Edit titles")
            }
            .buttonStyle(GlassButtonStyle(active: editing))

            Menu {
                Button {
                    draftName = list?.name ?? ""
                    draftDescription = list?.description ?? ""
                    renaming = true
                } label: {
                    Label("Rename…", systemImage: "pencil")
                }
                Divider()
                Button(role: .destructive) {
                    confirmingDelete = true
                } label: {
                    Label("Delete list…", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis").font(.system(size: 13, weight: .semibold))
            }
            .menuStyle(.button)
            .buttonStyle(GlassButtonStyle())
            .menuIndicator(.hidden)
            .fixedSize()
        }
    }

    private func load() async {
        do {
            list = try await AccountClient.shared.list(id)
        } catch AccountError.signedOut {
            account.sessionRejected()
        } catch {}
        loaded = true
    }

    private func remove(_ item: MediaItem) async {
        removing.insert(item.id)
        defer { removing.remove(item.id) }
        do {
            try await AccountClient.shared.removeFromList(id, item.mediaType(fallback: .movie), id: item.id)
            list?.results.removeAll { $0.id == item.id }
            list?.itemCount = max(0, (list?.itemCount ?? 1) - 1)
            account.didChange()
        } catch {
            account.failure = "That didn't save. Check your connection and try again."
        }
    }

    private func rename() async {
        let name = draftName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        do {
            try await AccountClient.shared.updateList(id, name: name, description: draftDescription)
            account.didChange()
        } catch {
            account.failure = "That didn't save. Check your connection and try again."
        }
    }

    private func delete() async {
        do {
            try await AccountClient.shared.deleteList(id)
            account.didChange()
            dismiss()
        } catch {
            account.failure = "Couldn't delete that list. Check your connection and try again."
        }
    }
}
