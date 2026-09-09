"use client";

import { useEffect } from "react";
import { enableSpatialNavigation } from "@/lib/tv/spatial-nav";

/**
 * Enables the Google TV "10-foot" experience: D-pad focus navigation plus the
 * big couch-visible focus ring (styled by `html.tv` in globals.css).
 *
 * TV mode turns on when the page is opened in the TV WebView (its User-Agent
 * carries a `ChillFlixTV` tag), on an Android TV / Google TV browser, or with
 * `?tv=1` for testing on a desktop. The flag is remembered in sessionStorage so
 * it survives client-side navigation after the query param is gone.
 */
export function TVMode() {
  useEffect(() => {
    const ua = navigator.userAgent;
    const params = new URLSearchParams(window.location.search);

    const isTV =
      /ChillFlixTV/i.test(ua) ||
      params.has("tv") ||
      rememberedTV() ||
      (/Android/i.test(ua) && /\bTV\b|BRAVIA|AFT[A-Z]|GoogleTV|Chromecast|Web0S|SMART-TV/i.test(ua));

    if (!isTV) return;

    rememberTV();
    document.documentElement.classList.add("tv");
    return enableSpatialNavigation();
  }, []);

  return null;
}

/**
 * Web storage is guarded here for the same reason it is in lib/storage.ts:
 * touching it *throws* rather than returning null when a browser has storage
 * disabled — private modes, and several of the smart-TV browsers this mode
 * exists for. Unguarded, that throw escapes the effect and takes the whole page
 * down, which is the worst possible failure on the one device class TV mode is
 * built for: the televisions least able to store anything are the ones that
 * need the D-pad most.
 *
 * Losing the memory is survivable — the User-Agent and `?tv=1` checks still
 * decide correctly on every load; only the carry-over across a client-side
 * navigation from a bare `?tv=1` is lost.
 */
function rememberedTV(): boolean {
  try {
    return window.sessionStorage.getItem("tv") === "1";
  } catch {
    return false;
  }
}

function rememberTV() {
  try {
    window.sessionStorage.setItem("tv", "1");
  } catch {
    // Nothing to remember it with; every load re-derives the answer anyway.
  }
}
