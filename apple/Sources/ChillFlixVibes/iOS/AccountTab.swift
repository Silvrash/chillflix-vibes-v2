import SwiftUI

/// The viewer's own tab: who they are, the five collections, and the way out.
///
/// On the Mac these hang off a menu in the nav pill. A phone has a tab bar
/// and no pill, and a tab of the viewer's own is where every other app on the
/// device puts this, so it is where a thumb goes looking.
struct AccountTab: View {
    @EnvironmentObject private var account: AccountStore

    var body: some View {
        Group {
            if !account.ready {
                LoadingIndicator()
            } else if let profile = account.profile {
                signedIn(profile)
            } else {
                signedOut
            }
        }
        .background(Palette.background)
        .navigationTitle("My Stuff")
    }

    private func signedIn(_ profile: AccountProfile) -> some View {
        List {
            Section {
                HStack(spacing: 14) {
                    AvatarView(path: profile.avatarPath, initial: profile.username.first.map(String.init) ?? "?", size: 52)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(profile.username)
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(.white)
                        Text("Signed in with TMDB")
                            .font(.system(size: 13))
                            .foregroundStyle(Palette.muted)
                    }
                }
                .padding(.vertical, 6)
            }

            Section {
                NavigationLink(value: Route.library(.watchlist)) { Label("Watchlist", systemImage: "bookmark") }
                NavigationLink(value: Route.library(.favorites)) { Label("Favourites", systemImage: "heart") }
                NavigationLink(value: Route.library(.ratings)) { Label("Ratings", systemImage: "star") }
                NavigationLink(value: Route.lists) { Label("Lists", systemImage: "text.badge.plus") }
                NavigationLink(value: Route.recommendations) { Label("For you", systemImage: "sparkles") }
            }

            Section {
                Button(role: .destructive) {
                    Task { await account.signOut() }
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
                .disabled(account.busy)
            } footer: {
                Text("Your watchlist, favourites, ratings and lists live on your TMDB account and follow you to the site, your TV and your Mac.")
            }
        }
        .scrollContentBackground(.hidden)
        .tint(.white)
    }

    private var signedOut: some View {
        VStack(spacing: 0) {
            Spacer()
            VStack(spacing: 18) {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 44, weight: .light))
                    .foregroundStyle(Palette.muted)
                Text("Your own shelf")
                    .font(.system(size: 24, weight: .bold))
                    .tracking(-0.4)
                    .foregroundStyle(.white)
                Text("Sign in with your TMDB account to keep a watchlist, favourites, ratings and lists that follow you between your phone, the site, your TV and your Mac.")
                    .font(.system(size: 14.5))
                    .foregroundStyle(Palette.muted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 360)
                Button {
                    Task { await account.signIn() }
                } label: {
                    ActionLabel(symbol: "person.crop.circle", title: "Sign in with TMDB")
                }
                .buttonStyle(SolidButtonStyle())
                .disabled(account.busy)
                .padding(.top, 6)
                Text("No TMDB account? Signing in offers to make one.")
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.muted.opacity(0.7))
            }
            .padding(.horizontal, 32)
            Spacer()
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

/// The viewer's TMDB avatar, or their initial when they have not set one.
struct AvatarView: View {
    let path: String?
    let initial: String
    var size: CGFloat = 22

    var body: some View {
        Group {
            if let url = TmdbImage.url(path, size: "w185") {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    fallback
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var fallback: some View {
        Circle()
            .fill(Color.white.opacity(0.10))
            .overlay(
                Text(initial.uppercased())
                    .font(.system(size: size * 0.42, weight: .semibold))
                    .foregroundStyle(.white)
            )
    }
}
