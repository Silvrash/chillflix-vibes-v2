import AuthenticationServices
import Foundation

enum SignInError: Error {
    case cancelled
    case denied
    case failed
}

/// The TMDB approval round trip, run through the system's authentication
/// session rather than a web view of our own.
///
/// The web view was the obvious choice and the wrong one. Google refuses to
/// sign anyone in inside an embedded web view, and TMDB's login page offers
/// "Continue with Google" — so a viewer who signed up that way would reach a
/// button that silently does nothing. The system session is Safari's engine:
/// Google works, and a viewer already signed in to TMDB there is one tap from
/// done rather than a password away.
///
/// The site does the rest. Its login route is started with `native=1`, and
/// its callback answers with a redirect to `chillflixvibes://signin` carrying
/// the sealed session, which the authentication session intercepts and hands
/// back here. Neither app registers that scheme system-wide: it is only ever
/// delivered to the session that asked for it.
@MainActor
final class SignInSession: NSObject, ASWebAuthenticationPresentationContextProviding {
    private static let scheme = "chillflixvibes"

    private var session: ASWebAuthenticationSession?

    /// The sealed session, or throws with why there is not one.
    func run() async throws -> String {
        let url = URL(string: TmdbClient.siteURL + "/api/account/login?native=1")!

        return try await withCheckedThrowingContinuation { continuation in
            // Exactly once. A session that fails to start reports it twice —
            // `start()` returns false *and* the completion handler is called
            // with an error — and a continuation resumed twice is a trap.
            var resumed = false
            func finish(_ result: Result<String, Error>) {
                guard !resumed else { return }
                resumed = true
                continuation.resume(with: result)
            }

            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: Self.scheme) { callback, error in
                if let error {
                    let code = (error as? ASWebAuthenticationSessionError)?.code
                    finish(.failure(code == .canceledLogin ? SignInError.cancelled : SignInError.failed))
                    return
                }
                guard let callback,
                      let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems else {
                    finish(.failure(SignInError.failed))
                    return
                }
                if let sealed = items.first(where: { $0.name == "session" })?.value, !sealed.isEmpty {
                    finish(.success(sealed))
                } else if items.contains(where: { $0.name == "denied" }) {
                    finish(.failure(SignInError.denied))
                } else {
                    finish(.failure(SignInError.failed))
                }
            }
            // Shared with Safari on purpose: a viewer signed in to TMDB there
            // gets the approval page straight away, not the login form first.
            session.prefersEphemeralWebBrowserSession = false
            session.presentationContextProvider = self
            self.session = session
            if !session.start() { finish(.failure(SignInError.failed)) }
        }
    }

    /// The window the sheet is presented from. Without one the session
    /// refuses to start, so this is thorough: the key window first, then any
    /// window of a scene that is on screen, then any window at all.
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        #if os(macOS)
        return NSApp.keyWindow ?? NSApp.mainWindow ?? NSApp.windows.first ?? ASPresentationAnchor()
        #else
        let scenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .sorted { $0.activationState.rawValue < $1.activationState.rawValue }
        let windows = scenes.flatMap(\.windows)
        return windows.first(where: \.isKeyWindow) ?? windows.first ?? ASPresentationAnchor()
        #endif
    }
}
