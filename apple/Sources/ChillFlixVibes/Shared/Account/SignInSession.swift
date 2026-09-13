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
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: Self.scheme) { callback, error in
                if let error {
                    let code = (error as? ASWebAuthenticationSessionError)?.code
                    continuation.resume(throwing: code == .canceledLogin ? SignInError.cancelled : SignInError.failed)
                    return
                }
                guard let callback,
                      let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems else {
                    continuation.resume(throwing: SignInError.failed)
                    return
                }
                if let sealed = items.first(where: { $0.name == "session" })?.value, !sealed.isEmpty {
                    continuation.resume(returning: sealed)
                } else if items.contains(where: { $0.name == "denied" }) {
                    continuation.resume(throwing: SignInError.denied)
                } else {
                    continuation.resume(throwing: SignInError.failed)
                }
            }
            // Shared with Safari on purpose: a viewer signed in to TMDB there
            // gets the approval page straight away, not the login form first.
            session.prefersEphemeralWebBrowserSession = false
            session.presentationContextProvider = self
            self.session = session
            if !session.start() { continuation.resume(throwing: SignInError.failed) }
        }
    }

    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        #if os(macOS)
        return NSApp.keyWindow ?? NSApp.windows.first ?? ASPresentationAnchor()
        #else
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.flatMap(\.windows).first(where: \.isKeyWindow) ?? scenes.first?.windows.first ?? ASPresentationAnchor()
        #endif
    }
}
