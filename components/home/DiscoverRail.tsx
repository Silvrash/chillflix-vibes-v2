"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { MediaRail, MediaRailSkeleton } from "@/components/media/MediaRail";
import { MediaType, getDiscoverMoviesInfiniteQuery, getDiscoverTVShowsInfiniteQuery } from "@/lib/tmdb/queries";
import { withPoster } from "./rail-items";
import { useUnshownItems } from "./shown-titles";
import type { HomeRail } from "./rails";

export interface DiscoverRailProps extends HomeRail {
  /** This row's claim on a title two rows drew: lowest `order` keeps it. Not page position — see ./HomeRails.tsx. */
  order: number;
}

// Must stay in step with BrowsePage's: these rails share its query key on purpose, so the two
// have to agree on what a page is.
const infinitePageParams = {
  initialPageParam: 1,
  getNextPageParam: (lastPage: { page: number; total_pages: number }) =>
    lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
};

/**
 * How many cards a rail will ever mount. A row is a sample — "See all" is one click away — and
 * sharing a cache entry with that grid means the rail can inherit however far the visitor scrolled
 * it: the grid pages itself on an observer, so coming back to the home page would otherwise mount
 * every card that grid ever loaded, in one row, each with a hover preview of its own.
 */
const MAX_ITEMS = 30;

/**
 * The length below which a row goes and fetches itself more, rather than waiting to be scrolled.
 *
 * Deduping is what puts it there — a row keeps only what the rows above it aren't showing, and one
 * page of twenty can come back a stub, or empty. It cannot scroll its way out of that: `loadMore`
 * rides on the scroller's scroll event, and a row that no longer overflows never fires one, so
 * short is a state it would otherwise stay in for good.
 *
 * Twelve is a little more than the widest layout shows at once (nine posters at 1600px), so a row
 * that reaches this is scrollable again as well as worth looking at.
 */
const MIN_ITEMS = 12;

/**
 * How many extra pages that backfill may pull. A row whose whole catalogue is claimed above it —
 * the anime rail under an anime rail — would otherwise walk TMDB's hundreds of pages one request
 * at a time, on a page nobody has scrolled. Coming up short is better than that.
 */
const MAX_BACKFILL_PAGES = 3;

/**
 * One curated /discover row, fetched on its own so a slow or failed rail never holds up the rest
 * of the page — and only once it is close to the viewport, so the rows below the fold don't race
 * the hero artwork for bandwidth on first paint.
 */
export function DiscoverRail({ title, mediaType, href, variables, order }: DiscoverRailProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = anchorRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { rootMargin: "400px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The movie/TV factories return differently-typed option objects that `useInfiniteQuery` can't
  // unify across a ternary, so we normalise to one concrete option type (as BrowsePage does).
  const options = (
    mediaType === MediaType.movie
      ? getDiscoverMoviesInfiniteQuery({ enabled: inView, variables: variables as any, ...infinitePageParams })
      : getDiscoverTVShowsInfiniteQuery({ enabled: inView, variables: variables as any, ...infinitePageParams })
  ) as ReturnType<typeof getDiscoverMoviesInfiniteQuery>;

  const query = useInfiniteQuery(options);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  const fetched = useMemo(() => withPoster(query.data?.pages.flatMap((page) => page.results) ?? []), [query.data]);
  const items = useUnshownItems(order, mediaType, fetched, MAX_ITEMS);

  const loadMore = useCallback(() => {
    if (items.length >= MAX_ITEMS) return;
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const pagesFetched = query.data?.pages.length ?? 0;
  // `inView` is in here as well as on the query because `fetchNextPage` is imperative: it pages
  // whatever is in the cache whether or not the query is enabled. These rails share a cache entry
  // with /movies, /tv and /anime, so a visitor arriving from one of those finds this row already
  // holding pages — and without this, a row nobody has scrolled to would fetch off the back of them,
  // which is the whole deferral the row exists to provide.
  //
  // `isError` is what stops a failed page from being asked for again the moment the fetch flag
  // clears — which, unlike the scroll this replaces, nothing outside the row would rate-limit.
  const backfilling =
    inView &&
    Boolean(hasNextPage) &&
    !query.isError &&
    items.length < MIN_ITEMS &&
    pagesFetched > 0 &&
    pagesFetched <= MAX_BACKFILL_PAGES;

  useEffect(() => {
    if (backfilling && !isFetchingNextPage) void fetchNextPage();
  }, [backfilling, isFetchingNextPage, fetchNextPage]);

  // `isError` on an infinite query covers a failed *later* page as much as a failed first one, and
  // it leaves the pages that did arrive in `data` — so it is the absence of any page, not the error,
  // that means this row has nothing to draw. Keyed off the error alone, a rate-limited page 2 would
  // unmount the twenty cards the visitor had just scrolled to the end of.
  const drewNothing = query.isError && pagesFetched === 0;

  return (
    <div ref={anchorRef}>
      {/* A rail with nothing to draw is left out rather than shown as an error. `isPending` (not
          `isLoading`) is what stays true while the query waits to be enabled.
          A row deduped down to nothing keeps the skeleton while it refills, so the page doesn't
          close the gap and then push everything below it back down a request later. */}
      {drewNothing ? null : query.isPending || (items.length === 0 && backfilling) ? (
        <MediaRailSkeleton title={title} />
      ) : (
        <MediaRail title={title} href={href} items={items} onEndReached={loadMore} />
      )}
    </div>
  );
}
