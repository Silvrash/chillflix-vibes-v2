"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (per the Next.js PWA guide) so the app is
 * installable. `updateViaCache: "none"` plus the no-store header on /sw.js keep
 * the worker always revalidated, so updates ship instantly. The worker does no
 * asset caching, so there is no stale-code problem.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);

  return null;
}
