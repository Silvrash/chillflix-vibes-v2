"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SearchOverlay } from "./SearchOverlay";

export interface SearchOverlayContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const SearchOverlayContext = createContext<SearchOverlayContextValue | null>(null);

export function useSearchOverlay(): SearchOverlayContextValue {
  const context = useContext(SearchOverlayContext);
  // A trigger rendered outside the provider would silently do nothing; fail loudly at dev time.
  if (!context) throw new Error("useSearchOverlay must be used inside <SearchOverlayProvider>.");
  return context;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function SearchOverlayProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((previous) => !previous), []);

  // `/embed` is the chrome-less player the TV app loads: nothing may render over that video, and
  // nothing may listen for its remote's keys.
  const embedded = Boolean(pathname?.startsWith("/embed"));

  // Covers every way out of the overlay at once — a result card, a browser back, a prefetched link.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (embedded) return;

    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((previous) => !previous);
        return;
      }
      // "/" is only a shortcut when you are not already typing into something.
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        setIsOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [embedded]);

  const value = useMemo(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle]);

  return (
    <SearchOverlayContext.Provider value={value}>
      {children}
      {!embedded && <SearchOverlay open={isOpen} onClose={close} />}
    </SearchOverlayContext.Provider>
  );
}
