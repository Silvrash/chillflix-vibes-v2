"use client";

import { useEffect } from "react";
import { enableSpatialNavigation } from "@/lib/tv/spatial-nav";

/**
 * Enables the Google TV "10-foot" experience: D-pad focus navigation plus the
 * big couch-visible focus ring (styled by `html.tv` in globals.css).
 *
 * TV mode turns on when the page is opened in the TV WebView (its User-Agent
 * carries a `ChillFlixTV` tag), on an Android TV / Google TV browser, or with
 * `?tv=1` for testing on a desktop. The flag is stored in sessionStorage so it
 * survives client-side navigation after the query param is gone.
 */
export function TVMode() {
  useEffect(() => {
    const ua = navigator.userAgent;
    const params = new URLSearchParams(window.location.search);

    const isTV =
      /ChillFlixTV/i.test(ua) ||
      params.has("tv") ||
      sessionStorage.getItem("tv") === "1" ||
      (/Android/i.test(ua) && /\bTV\b|BRAVIA|AFT[A-Z]|GoogleTV|Chromecast|Web0S|SMART-TV/i.test(ua));

    if (!isTV) return;

    sessionStorage.setItem("tv", "1");
    document.documentElement.classList.add("tv");
    return enableSpatialNavigation();
  }, []);

  return null;
}
