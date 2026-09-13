import SwiftUI

/// Watchlist, favourite, rating and lists, for one title.
///
/// The counterpart of the site's `TitleActions` and `RatingControl` together.
/// It renders nothing at all when signed out, so the detail page a signed-out
/// viewer gets is exactly the page it was before accounts existed: one Play
/// button, nothing asking them to sign up for anything.
///
/// Every control writes, then asks the store to bump its revision rather than
/// patching its own state: the home shelves are watching the same revision,
/// which is how a title saved here shows up in the watchlist row without
/// either view knowing the other exists.
struct TitleActions: View {
    let type: MediaType
    let id: Int

    @EnvironmentObject private var account: AccountStore
    @State private var states = AccountStates()
    @State private var pending: Set<String> = []

    var body: some View {
        if let profile = account.profile {
            HStack(spacing: 10) {
                toggle(
                    key: "watchlist",
                    on: states.watchlist,
                    symbol: states.watchlist ? "bookmark.fill" : "bookmark",
                    title: states.watchlist ? "On your watchlist" : "Watchlist"
                ) { on in
                    try await AccountClient.shared.setWatchlist(accountId: profile.accountId, type, id: id, on: on)
                }

                toggle(
                    key: "favorite",
                    on: states.favorite,
                    symbol: states.favorite ? "heart.fill" : "heart",
                    title: states.favorite ? "Favourited" : "Favourite"
                ) { on in
                    try await AccountClient.shared.setFavorite(accountId: profile.accountId, type, id: id, on: on)
                }

                ratingMenu
                AddToListMenu(type: type, id: id)
            }
            .task(id: account.revision) { await reload() }
        }
    }

    // MARK: - Toggles

    private func toggle(
        key: String, on: Bool, symbol: String, title: String,
        write: @escaping (Bool) async throws -> Void
    ) -> some View {
        Button {
            Task { await perform(key) { try await write(!on) } }
        } label: {
            ActionLabel(symbol: pending.contains(key) ? "ellipsis" : symbol, title: title)
        }
        .buttonStyle(GlassButtonStyle(active: on))
        .disabled(pending.contains(key))
    }

    // MARK: - Rating

    /// One to ten behind a menu rather than a row of ten buttons: the row is
    /// what the site draws because a D-pad needs it, and a pointer does not.
    /// The label says the score once there is one, so a rated title reads as
    /// rated without opening anything.
    private var ratingMenu: some View {
        Menu {
            ForEach((1...10).reversed(), id: \.self) { value in
                Button {
                    Task { await perform("rating") { try await AccountClient.shared.rate(type, id: id, value: Double(value)) } }
                } label: {
                    if states.rating == Double(value) {
                        Label("\(value)", systemImage: "checkmark")
                    } else {
                        Text("\(value)")
                    }
                }
            }
            if states.rating != nil {
                Divider()
                Button("Clear rating", role: .destructive) {
                    Task { await perform("rating") { try await AccountClient.shared.clearRating(type, id: id) } }
                }
            }
        } label: {
            ActionLabel(
                symbol: states.rating == nil ? "star" : "star.fill",
                title: states.rating.map { "Rated \(Int($0))" } ?? "Rate"
            )
        }
        .menuStyle(.button)
        .buttonStyle(GlassButtonStyle(active: states.rating != nil))
        .menuIndicator(.hidden)
        .fixedSize()
        .disabled(pending.contains("rating"))
    }

    // MARK: - Plumbing

    private func reload() async {
        do {
            states = try await AccountClient.shared.states(type, id: id)
        } catch AccountError.signedOut {
            account.sessionRejected()
        } catch {
            // Left as it was: a dropped request should not blank a control the
            // viewer may be about to press.
        }
    }

    private func perform(_ key: String, _ write: () async throws -> Void) async {
        pending.insert(key)
        defer { pending.remove(key) }
        do {
            try await write()
            account.didChange()
        } catch AccountError.signedOut {
            account.sessionRejected()
        } catch {
            account.failure = "That didn't save. Check your connection and try again."
        }
    }
}

/// The viewer's lists with a tick beside each this title is on, and a way to
/// start a new one.
///
/// Membership is one request per list — TMDB has no "which of my lists hold
/// this" endpoint — so it is bounded at twelve, the same cap the site keeps,
/// and asked for once per revision rather than once per open.
struct AddToListMenu: View {
    let type: MediaType
    let id: Int

    @EnvironmentObject private var account: AccountStore
    @State private var lists: [ListSummary] = []
    @State private var members: Set<Int> = []
    @State private var pending: Set<Int> = []
    @State private var naming = false
    @State private var newName = ""

    private static let cap = 12

    var body: some View {
        Menu {
            ForEach(lists) { list in
                Button {
                    Task { await toggle(list) }
                } label: {
                    if members.contains(list.id) {
                        Label(list.name, systemImage: "checkmark")
                    } else {
                        Text(list.name)
                    }
                }
                .disabled(pending.contains(list.id))
            }
            if lists.count >= Self.cap {
                Text("Showing your first \(Self.cap) lists")
            }
            if !lists.isEmpty { Divider() }
            Button {
                newName = ""
                naming = true
            } label: {
                Label("New list…", systemImage: "plus")
            }
        } label: {
            ActionLabel(symbol: members.isEmpty ? "text.badge.plus" : "text.badge.checkmark", title: "Lists")
        }
        .menuStyle(.button)
        .buttonStyle(GlassButtonStyle(active: !members.isEmpty))
        .menuIndicator(.hidden)
        .fixedSize()
        .task(id: account.revision) { await reload() }
        .alert("New list", isPresented: $naming) {
            TextField("Name", text: $newName)
            Button("Create and add") { Task { await createAndAdd() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Lists are private unless you make them public on TMDB.")
        }
    }

    private func reload() async {
        guard let profile = account.profile else { return }
        do {
            let page = try await AccountClient.shared.lists(objectId: profile.accountObjectId)
            lists = Array(page.results.prefix(Self.cap))
            members = await withTaskGroup(of: (Int, Bool).self, returning: Set<Int>.self) { group in
                for list in lists {
                    group.addTask { (list.id, await AccountClient.shared.isOnList(list.id, type, id: id)) }
                }
                var found = Set<Int>()
                for await (listId, on) in group where on { found.insert(listId) }
                return found
            }
        } catch AccountError.signedOut {
            account.sessionRejected()
        } catch {}
    }

    private func toggle(_ list: ListSummary) async {
        pending.insert(list.id)
        defer { pending.remove(list.id) }
        do {
            if members.contains(list.id) {
                try await AccountClient.shared.removeFromList(list.id, type, id: id)
            } else {
                try await AccountClient.shared.addToList(list.id, type, id: id)
            }
            account.didChange()
        } catch AccountError.signedOut {
            account.sessionRejected()
        } catch {
            account.failure = "That didn't save. Check your connection and try again."
        }
    }

    private func createAndAdd() async {
        let name = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        do {
            let listId = try await AccountClient.shared.createList(name: name)
            try await AccountClient.shared.addToList(listId, type, id: id)
            account.didChange()
        } catch AccountError.signedOut {
            account.sessionRejected()
        } catch {
            account.failure = "Couldn't create that list. Check your connection and try again."
        }
    }
}
