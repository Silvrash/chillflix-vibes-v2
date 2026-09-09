"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MediaType } from "@/lib/tmdb/queries";

/**
 * A TMDB id is only unique inside its media type — movie 1399 and series 1399 are different
 * titles — so what a rail publishes is the id together with the type it was drawn from.
 */
function titleKey(mediaType: MediaType, id: number): string {
  return `${mediaType}:${id}`;
}

interface ShownTitles {
  /** What each rail is showing, keyed by the rank its claim carries. */
  claims: Record<number, string[]>;
  claim: (order: number, keys: string[]) => void;
}

const ShownTitlesContext = createContext<ShownTitles | null>(null);

/**
 * Lets each rail see what the rows with a stronger claim have already put on screen.
 *
 * The rows run deliberately different queries (see ./rails.ts), but they draw on one catalogue and
 * TMDB will hand the same title to two of them sooner or later — a top-rated classic that is also
 * trending today, an anime that is also an action series. This is the belt to that braces: a rail
 * publishes the titles it is showing, and every rail it outranks drops them.
 *
 * `order` is that rank and nothing else — lowest keeps the title. It is not mount or arrival order,
 * and it is deliberately not position on the page: the Top 10s rank ahead of the hero that renders
 * above them, because their heading is the one claim on the page that cannot give a title up (the
 * ranking lives in ./HomeRails.tsx). Ranking rather than racing is what makes the outcome stable —
 * the rails fetch independently and land out of turn, so a row that arrives late still takes its
 * titles back off the rows it outranks, rather than every row having to wait for the ones above it.
 *
 * Claims are published from an effect, so during a server render there are none: every row sees an
 * empty registry and keeps everything it drew. That is only safe for a row whose server HTML is a
 * skeleton anyway — the /discover rows, which wait to be scrolled to. The rows that do render real
 * titles on the server (the hero and the Top 10s) must therefore not be reading this to decide what
 * they show, or the HTML ships one arrangement and hydration replaces it with another; they settle
 * between themselves in ./rail-items.ts and only publish here.
 */
export function ShownTitlesProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<Record<number, string[]>>({});

  const claim = useCallback((order: number, keys: string[]) => {
    // A rail re-publishes on every render it survives; only a changed row is worth a re-render of
    // the rails it outranks.
    setClaims((current) => (sameKeys(current[order], keys) ? current : { ...current, [order]: keys }));
  }, []);

  const value = useMemo(() => ({ claims, claim }), [claims, claim]);

  return <ShownTitlesContext.Provider value={value}>{children}</ShownTitlesContext.Provider>;
}

/**
 * Publishes the titles a row is showing under the rank of its claim, so the rows it outranks can
 * drop them. Pass what the row actually draws, never what it fetched and cut, or lower-ranked rows
 * give up titles nobody is showing.
 *
 * This is the whole of what the rows above the fold do with the registry: they contribute to it and
 * read nothing from it, which is what lets their output be identical on the server and in the
 * browser.
 */
export function useClaimItems<T extends { id: number }>(order: number, mediaType: MediaType, items: T[]): void {
  const claim = useContext(ShownTitlesContext)?.claim;
  const keys = useMemo(() => items.map((item) => titleKey(mediaType, item.id)), [items, mediaType]);

  useEffect(() => {
    claim?.(order, keys);
  }, [claim, order, keys]);
}

/**
 * The items a rail should draw: the ones no row that outranks it is showing, capped at `limit` —
 * and published under `order` so the rows it outranks in turn can do the same.
 *
 * Capping here rather than at the call site is what keeps the published list honest: a rail claims
 * the titles it actually shows, never the ones it fetched and cut.
 */
export function useUnshownItems<T extends { id: number }>(order: number, mediaType: MediaType, items: T[], limit: number): T[] {
  const claims = useContext(ShownTitlesContext)?.claims;

  const spokenFor = useMemo(() => {
    const keys = new Set<string>();
    for (const [rank, claimed] of Object.entries(claims ?? {})) {
      if (Number(rank) < order) for (const key of claimed) keys.add(key);
    }
    return keys;
  }, [claims, order]);

  const visible = useMemo(
    () => items.filter((item) => !spokenFor.has(titleKey(mediaType, item.id))).slice(0, limit),
    [items, spokenFor, mediaType, limit],
  );

  useClaimItems(order, mediaType, visible);

  return visible;
}

function sameKeys(current: string[] | undefined, next: string[]): boolean {
  return current !== undefined && current.length === next.length && current.every((key, index) => key === next[index]);
}
