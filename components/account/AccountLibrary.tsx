"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MediaGrid } from "@/components/media/MediaGrid";
import {
  getFavoriteMoviesQuery,
  getFavoriteTvQuery,
  getRatedMoviesQuery,
  getRatedTvQuery,
  getWatchlistMoviesQuery,
  getWatchlistTvQuery,
} from "@/lib/tmdb/account-queries";
import { MediaType } from "@/lib/tmdb/queries";
import { useAccount } from "./AccountProvider";

type LibraryKind = "watchlist" | "favorites" | "ratings";

/**
 * A signed-in collection, in the shape of a browse page.
 *
 * It reuses the browse shell's spacing and `MediaGrid` rather than inventing a
 * layout, so a watchlist reads as another way of browsing rather than a
 * different room. It is not a `BrowseSidebar` section, though: sidebar state
 * derives entirely from URL filters, and a watchlist is not a `/discover` query,
 * so it cannot be expressed as one.
 */
export function AccountLibrary({ kind }: { kind: LibraryKind }) {
  const { account, ready } = useAccount();
  const accountId = account?.accountId ?? 0;

  const sources: Record<LibraryKind, [typeof getWatchlistMoviesQuery, typeof getWatchlistTvQuery]> = {
    watchlist: [getWatchlistMoviesQuery, getWatchlistTvQuery],
    favorites: [getFavoriteMoviesQuery, getFavoriteTvQuery],
    ratings: [getRatedMoviesQuery, getRatedTvQuery],
  };
  const [movieQuery, tvQuery] = sources[kind];

  const movies = useQuery({
    ...movieQuery({ variables: { account_id: accountId, sort_by: "created_at.desc" } }),
    enabled: Boolean(account),
    retry: false,
  });
  const shows = useQuery({
    ...tvQuery({ variables: { account_id: accountId, sort_by: "created_at.desc" } }),
    enabled: Boolean(account),
    retry: false,
  });

  const items = useMemo(() => {
    const films = (movies.data?.results ?? []).map((item) => ({ ...item, media_type: MediaType.movie }));
    const series = (shows.data?.results ?? []).map((item) => ({ ...item, media_type: MediaType.tv }));
    return [...films, ...series];
  }, [movies.data, shows.data]);

  const { title, blurb, empty } = COPY[kind];
  const loading = movies.isPending || shows.isPending;

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-24 sm:px-6 sm:pt-28 lg:px-10">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {account && !loading && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted">
            {items.length} {items.length === 1 ? "title" : "titles"}
          </span>
        )}
      </div>
      <p className="mt-2 text-muted">{blurb}</p>

      {/* Three states, and they say different things. Not signed in is not the
          same as an empty list, and neither is the same as still loading. */}
      {!ready ? null : !account ? (
        <SignedOut />
      ) : loading ? null : items.length === 0 ? (
        <Empty message={empty} />
      ) : (
        <MediaGrid className="mt-8" items={items} />
      )}
    </div>
  );
}

function SignedOut() {
  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-surface/60 p-8">
      <p className="text-muted">Sign in with TMDB to keep a watchlist that follows you between your browser, your TV and your Mac.</p>
      <a
        href="/api/account/login"
        className="mt-5 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
      >
        Sign in with TMDB
      </a>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-surface/60 p-8">
      <p className="text-muted">Nothing here yet. {message}</p>
    </div>
  );
}

/** One row per collection, so a fourth is a row rather than three more branches. */
const COPY: Record<LibraryKind, { title: string; blurb: string; empty: string }> = {
  watchlist: {
    title: "Your watchlist",
    blurb: "Titles you have saved on TMDB. They follow your account, not this device.",
    empty: "Add a title from its page and it will show up here.",
  },
  favorites: {
    title: "Your favourites",
    blurb: "Titles you have marked as favourites on TMDB.",
    empty: "Mark a title as a favourite and it will show up here.",
  },
  ratings: {
    title: "Your ratings",
    blurb: "Titles you have scored on TMDB. These are what its recommendations for you are built from.",
    empty: "Rate a title out of ten from its page and it will show up here.",
  },
};
