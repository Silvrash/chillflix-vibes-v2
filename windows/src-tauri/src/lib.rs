//! ChillFlixVibes for Windows.
//!
//! A window around the site, not a rewrite of it. The Mac and iOS apps share a
//! Swift codebase and the TV app is Kotlin; there is nothing native to share
//! with Windows, and the site is already the best version of the interface —
//! responsive, signed in, playing. So this is that site in WebView2, which
//! every Windows 10 and 11 machine already has: a real window with the app's
//! own icon and taskbar identity, at a few megabytes rather than the hundred
//! and fifty a bundled browser would cost.
//!
//! Sign-in works as it does on the web. The site sends the viewer to TMDB and
//! back in the same window, and the session cookie lands in WebView2's own
//! store under `%LOCALAPPDATA%\com.chillflixvibes.windows`, where it persists
//! between launches.

use tauri::webview::NewWindowResponse;
use tauri::{Theme, WebviewUrl, WebviewWindowBuilder};

/// The deployment this window shows.
const SITE: &str = "https://chillflixvibes.vercel.app";

/// The hosts a new-window request is allowed to reach, and it reaches them in
/// the system browser rather than in a window of ours.
///
/// Everything else is refused, silently. Nearly every new-window request from
/// a streaming page is a popup the embed provider is trying to open, and in a
/// browser those land as tabs; here they land nowhere. The site's own outward
/// links — TMDB's page for a title, the source on GitHub — are the exceptions.
const OPENS_OUTSIDE: &[&str] = &["themoviedb.org", "www.themoviedb.org", "github.com", "www.github.com"];

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Remembers where the window was and how big, between launches. Works
        // from Rust alone; the page never talks to it.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            // Built here rather than declared in tauri.conf.json so the
            // new-window handler below can be attached — there is no
            // configuration key for it.
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(SITE.parse().expect("site url")))
                .title("ChillFlixVibes")
                .inner_size(1280.0, 800.0)
                .min_inner_size(960.0, 600.0)
                .theme(Some(Theme::Dark))
                .center()
                .on_new_window(|url, _features| {
                    if OPENS_OUTSIDE.contains(&url.host_str().unwrap_or("")) {
                        let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
                    }
                    NewWindowResponse::Deny
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ChillFlixVibes");
}
