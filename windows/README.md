# ChillFlixVibes for Windows

A window around the site. The Mac and iOS apps share a Swift codebase and the
TV app is Kotlin; there is nothing native to share with Windows, and the site is
already the best version of the interface. So this is that site in WebView2 —
which every Windows 10 and 11 machine already has — inside a real window with
the app's own icon and taskbar identity, built with [Tauri](https://v2.tauri.app).
The installer is a few megabytes.

Sign-in works as on the web: the site sends you to TMDB and back in the same
window, and the session persists between launches in WebView2's own store.
Popups the embed providers try to open are refused; the site's own outward
links (TMDB, GitHub) open in your default browser.

## Building

The installer is built by GitHub Actions on a Windows runner — see
`.github/workflows/windows.yml`. A push that touches `windows/` builds it and
keeps it as a workflow artifact; pushing a tag `windows-v1.0.0` builds it and
publishes a GitHub release with the installer attached.

Locally, on any platform with Rust installed, the shell itself builds and
runs — on a Mac it comes up as a Mac window, which is enough to check the
shell's behaviour, not the installer:

```bash
cd windows && pnpm install
pnpm dev        # run it
pnpm build      # bundle for the platform you are on
pnpm icons      # regenerate src-tauri/icons from app-icon.png
```

## Installing

The installer is unsigned, so the first time Windows shows *"Windows protected
your PC"*. Choose **More info**, then **Run anyway**. It only asks once, and it
installs for the current user without an administrator prompt. If the machine
somehow lacks the WebView2 runtime, the installer fetches it.
