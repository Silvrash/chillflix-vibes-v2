# ChillFlixVibes — Google TV app

A thin Android WebView shell that runs the ChillFlixVibes web app on Google TV /
Android TV. The website provides the whole "10-foot" experience — D-pad
navigation and big focus rings, enabled automatically because this shell tags
its User-Agent with `ChillFlixTV` (and loads the site with `?tv=1`).

There's no native UI to maintain here: ship features on the web and the TV app
picks them up on next launch. This is for personal / sideloaded use — it is
**not** for the Play Store (Google rejects webview-wrapper apps and this content
category).

## 1. Point it at your site

Edit [`app/src/main/res/values/strings.xml`](app/src/main/res/values/strings.xml)
and set `site_url` to your deployment, e.g.

```xml
<string name="site_url">https://your-domain.com/?tv=1</string>
```

- Keep the `?tv=1` — it forces TV mode even if User-Agent detection is off.
- Using a plain `http://…` URL (e.g. a LAN dev server like
  `http://192.168.1.20:3000/?tv=1`)? Add
  `android:usesCleartextTraffic="true"` to `<application>` in
  [`AndroidManifest.xml`](app/src/main/AndroidManifest.xml).

## 2. Build the APK

**Easiest — Android Studio:** open the `android-tv/` folder, let it sync, then
**Build → Build Bundle(s) / APK(s) → Build APK(s)**.

**Command line** (needs a JDK 17 + the Android SDK; set `sdk.dir` in
`local.properties` or the `ANDROID_HOME` env var):

```bash
cd android-tv
gradle wrapper          # first time only — generates ./gradlew
./gradlew assembleRelease
```

The signed, installable APK lands at:

```
app/build/outputs/apk/release/app-release.apk
```

It's signed with the Android debug key, so it installs on any device without a
keystore — fine for personal sideloading.

## 3. Install on Google TV

**Via adb (over the network):**

```bash
# On the TV: Settings → System → About → tap "Build" 7× to enable Developer
# options, then Settings → System → Developer options → USB/Network debugging ON.
adb connect <tv-ip>:5555
adb install -r app/build/outputs/apk/release/app-release.apk
```

**Without a computer:** put `app-release.apk` somewhere reachable (Google Drive,
a web link, or a USB stick) and open it with the **Downloader** app (from the
Play Store on the TV), which installs local/remote APKs.

After install, "ChillFlixVibes" appears in the Google TV apps row. Launch it and
navigate with the remote's D-pad; **Back** goes back through history and exits
fullscreen video.

## Project layout

| Path | What it is |
| --- | --- |
| `app/src/main/java/.../MainActivity.kt` | The WebView shell: UA tag, fullscreen-video handoff, Back-button history |
| `app/src/main/AndroidManifest.xml` | Leanback launcher entry, permissions, TV feature flags |
| `app/src/main/res/values/strings.xml` | **`site_url`** — the page to load |
| `app/src/main/res/drawable/banner.png` | 320×180 home-row tile |
| `app/src/main/res/drawable/ic_launcher.png` | App icon |
