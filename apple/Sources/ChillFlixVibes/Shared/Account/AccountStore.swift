import Foundation

/// Who is signed in, for the whole app.
///
/// The counterpart of the site's `AccountProvider`: one place that knows
/// whether there is a viewer, restores them at launch from the keychain, and
/// tells every screen when their data has changed. Signed out is the default
/// and costs nothing — with no stored session, no account request is ever made
/// and every account control renders nothing.
@MainActor
final class AccountStore: ObservableObject {
    static let shared = AccountStore()

    private static let keychainAccount = "tmdb-session"

    @Published private(set) var profile: AccountProfile?
    /// False until the stored session has been checked, so nothing flashes the
    /// wrong state on launch.
    @Published private(set) var ready = false
    @Published private(set) var busy = false
    /// Bumped after every write. Rails and title actions watch it and refetch,
    /// which is how a title added on the detail page appears in the home
    /// row without either knowing about the other.
    @Published private(set) var revision = 0
    @Published var failure: String?

    var isSignedIn: Bool { profile != nil }

    /// At launch: pick up the session from the last run, if any, and confirm
    /// the server still honours it.
    func restore() async {
        defer { ready = true }
        guard let sealed = Keychain.read(Self.keychainAccount) else { return }
        await AccountClient.shared.use(session: sealed)
        await refreshProfile()
    }

    func signIn() async {
        busy = true
        defer { busy = false }
        do {
            let sealed = try await SignInSession().run()
            Keychain.write(sealed, account: Self.keychainAccount)
            await AccountClient.shared.use(session: sealed)
            await refreshProfile()
            revision += 1
        } catch SignInError.cancelled, SignInError.denied {
            // Closing the sheet or declining on TMDB's page are both choices,
            // not failures, and neither deserves a message.
        } catch {
            failure = "Could not sign in. Check your connection and try again."
        }
    }

    func signOut() async {
        busy = true
        defer { busy = false }
        await AccountClient.shared.logout()
        forget()
    }

    /// For any screen that met `AccountError.signedOut`: the session is gone
    /// server-side, so it goes here too rather than being retried forever.
    func sessionRejected() { forget() }

    func didChange() { revision += 1 }

    private func forget() {
        Keychain.delete(Self.keychainAccount)
        Task { await AccountClient.shared.use(session: nil) }
        profile = nil
        revision += 1
    }

    private func refreshProfile() async {
        do {
            let profile = try await AccountClient.shared.me()
            // A 200 with `signedIn: false` is the server saying the sealed
            // session no longer opens: expired, or its secret rotated.
            if let profile { self.profile = profile } else { forget() }
        } catch AccountError.signedOut {
            forget()
        } catch {
            // Offline: keep whatever was known. The session is not wrong, just
            // unreachable, and signing the viewer out over a dropped connection
            // would be the app losing their place.
        }
    }
}
