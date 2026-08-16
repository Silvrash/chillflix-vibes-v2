# ChillFlixVibes — Android TV / Google TV app

A **native** Android TV app: Kotlin + Jetpack Compose, TMDB data rendered as
focusable rows and grids. The D-pad moves a focus ring — there is no mouse
cursor anywhere in browse, search or the episode picker, which is the whole
point of this app existing alongside the website.

Only **playback** runs in a WebView, because the stream providers are embed
pages rather than direct video URLs. That part is wrapped in a native control
panel (player switching, episode strip, exit) so the remote still works.

```
MainActivity ──► Compose UI ──► /api/tmdb proxy on your deployment ──► TMDB
     │
     └─► PlayerActivity ──► WebView ──► embed provider
```

## 1. Point it at your deployment

Edit [`app/src/main/res/values/strings.xml`](app/src/main/res/values/strings.xml)
and set `api_base_url` to your site's origin (no trailing slash, no `/api`):

```xml
<string name="api_base_url">https://chillflixvibes.vercel.app</string>
```

The app calls that origin's `/api/tmdb/...` and `/api/anime-id/...` route
handlers, so **the TMDB token stays on your server** and is never shipped inside
the APK. It also means the app inherits the proxy's CDN caching.

Developing against a LAN dev server (`http://192.168.1.20:3000`)? Add
`android:usesCleartextTraffic="true"` to `<application>` in
[`AndroidManifest.xml`](app/src/main/AndroidManifest.xml).

## 2. Build

**Android Studio:** open the `android-tv/` folder, let it sync, then
**Build → Build Bundle(s) / APK(s) → Build APK(s)**.

**Command line** (JDK 17 + Android SDK; set `sdk.dir` in `local.properties` or
the `ANDROID_HOME` env var):

```bash
cd android-tv && ./gradlew assembleRelease
```

The installable APK lands at `app/build/outputs/apk/release/app-release.apk`,
signed with the Android debug key so it installs anywhere without a keystore.

## 3. Install on the TV

```bash
adb connect <tv-ip>:5555
adb install -r app/build/outputs/apk/release/app-release.apk
```

Enable developer options first: **Settings → System → About → tap "Build" 7×**,
then **Settings → System → Developer options → Network debugging**.

Without a computer: host `app-release.apk` somewhere reachable and open the URL
in the **Downloader** app on the TV.

The app appears in the Google TV apps row (it registers a
`LEANBACK_LAUNCHER` intent filter and ships a 320×180 banner).

## Using the remote

| Button | What it does |
| --- | --- |
| D-pad | Moves the focus ring; rows scroll automatically |
| Up (from a row) | Reaches the nav bar: Home / Movies / TV Shows / Anime / Search |
| OK | Opens a title, or starts playback from the Play button |
| Back | Goes back a screen; **in the player it opens the control panel**, and again exits |

## Project layout

| Path | What it is |
| --- | --- |
| `data/Models.kt` | TMDB response models (port of `lib/tmdb/queries.ts`) |
| `data/TmdbRepository.kt` | HTTP client for the site's API proxy, with an in-memory response cache |
| `data/Presets.kt` | Curated discover filters (port of `lib/presets.ts`) |
| `data/Streams.kt` | Embed URL builders (port of `lib/streaming/vidsrc.ts`) |
| `data/WatchStore.kt` | Last-watched season/episode, preferred player, Continue watching |
| `ui/ChillFlixApp.kt` | Navigation + nav bar |
| `ui/home` `ui/browse` `ui/search` `ui/detail` | The four browse screens |
| `ui/components/Components.kt` | Focusable cards, rows, chips, buttons |
| `player/PlayerActivity.kt` | Full-screen playback + native control panel |

Keep this in sync with the web app when the shared logic changes — presets,
stream providers and the API routes are duplicated here by design (the TV app
must work without shipping a JS runtime), so a change on one side usually wants
the same change on the other.

## Publishing

This produces a **sideloadable APK**. Getting it onto Google Play or the Amazon
Appstore is a different question from building it: both stores require that you
hold the rights to the content the app streams, and the embed providers this app
plays from (vidlink / vidsrc / vidnest) are unlicensed. A submission would be
rejected under Google Play's Intellectual Property policy, and the developer
account carries the liability. Nothing here is set up for store submission — no
release keystore, no Play Console metadata, no content declarations.

If you want a store-distributable TV app, the change needed is in the content
layer, not the UI: point playback at sources you're licensed to stream (your own
library, or a provider whose API terms permit it). This entire native UI works
unchanged against a different playback source — swap `data/Streams.kt`.
