# ChillFlixVibes for Mac, iPhone and iPad

One Swift codebase, two shells. `Sources/ChillFlixVibes/Shared` is every screen,
the data layer and the TMDB account layer; `Mac/` and `iOS/` are the thin shells
around it — a floating nav pill and window management on the Mac, a tab bar and
navigation bars on iOS. Both apps read from the deployed site's own API routes
and carry no TMDB key.

## Mac

Swift Package Manager, no Xcode project needed.

```bash
apple/build-mac.sh          # builds, assembles ChillFlixVibes.app, signs it ad hoc
apple/build-mac.sh --zip    # …and refreshes public/ChillFlixVibes-mac.zip for the install page
```

The app is not notarised, so the first launch is refused: right-click it and
choose Open, once.

## iPhone and iPad

An Xcode project, generated from `project.yml` by [xcodegen](https://github.com/yonaskolb/XcodeGen):

```bash
brew install xcodegen
cd apple && xcodegen generate && open ChillFlixVibes.xcodeproj
```

In Xcode, under Signing & Capabilities, pick your team once. Then choose your
iPhone or iPad as the destination and run. With a free Apple ID the install is
good for seven days at a time; a paid developer account signs it for a year,
or distributes it through TestFlight to a few people.

That is the whole distribution story. iOS does not install an `.ipa` from a
website, and this app cannot go through the App Store: the streams come from
embed providers that hold no licence to what they serve.

Requires iOS 18. Command-line build for the simulator, without signing:

```bash
xcodebuild -project ChillFlixVibes.xcodeproj -scheme ChillFlixVibes \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build CODE_SIGNING_ALLOWED=NO
```

## Signing in

Both apps sign in through the system's authentication session against the
site's `/api/account/login?native=1`. The site's callback answers with a
redirect to `chillflixvibes://signin` carrying the same sealed session the
browser would get as a cookie; the app keeps it in the keychain and sends it
back as that cookie. Every account request is then served by the site's
existing credentialed proxy — the allowlist, the sealing and the no-store
headers all apply unchanged.

The scheme is declared in both `Info.plist`s. The session intercepts it
itself, but macOS has been seen to drop a callback on an undeclared scheme.

## Opening a screen from the command line

The iOS shell reads a few launch arguments so any screen can be reached
without a finger on the glass — for screenshots, mostly:

```bash
xcrun simctl launch booted com.nyeova.chillflixvibes -cfv-tab browse
xcrun simctl launch booted com.nyeova.chillflixvibes -cfv-route detail/tv/1399
xcrun simctl launch booted com.nyeova.chillflixvibes -cfv-signin 1
```

`-cfv-tab` takes `browse`, `account` or `search`; `-cfv-route` takes
`detail/{movie|tv}/{id}`, `library/{watchlist|favorites|ratings}`, `lists`,
`recommendations` or `play/{movie|tv}/{id}`.
