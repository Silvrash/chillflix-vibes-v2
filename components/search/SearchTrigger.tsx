"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchOverlay } from "./SearchOverlayProvider";

/** Styled to drop straight into the navbar pill beside the links — its only home. */
export function SearchTrigger() {
  const { open } = useSearchOverlay();
  // Rendered as ⌘K first so the server and the first client render agree, then corrected on
  // whatever the visitor is actually holding.
  const [shortcut, setShortcut] = useState("⌘K");

  useEffect(() => {
    if (!/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)) setShortcut("Ctrl K");
  }, []);

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search"
      aria-keyshortcuts="Meta+K Control+K"
      className={cn(
        "relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white",
        // Search is the control a thumb goes for most, and at 375px it collapses to a bare
        // icon. `px-3.5` gets the drawn box to 44px wide; the height has to come from an
        // invisible overlay instead, because a 44px-tall button would push the whole navbar
        // pill taller than its 36px logo. -6px vertical stays inside the pill's own padding,
        // so nothing else in the row loses hit area.
        "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Search</span>
      <kbd className="ml-1 hidden rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-sans text-[11px] text-muted lg:inline">
        {shortcut}
      </kbd>
    </button>
  );
}
