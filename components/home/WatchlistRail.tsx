"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "@/components/account";
import { MediaRail } from "@/components/media/MediaRail";
import { getWatchlistMoviesQuery, getWatchlistTvQuery } from "@/lib/tmdb/account-queries";
import { MediaType } from "@/lib/tmdb/queries";
import { useClaimItems } from "./shown-titles";

/**
 * The viewer's own watchlist, and the first row on this page that is about them
 * rather than about what is popular.
 *
 * It renders nothing when signed out, so the page is unchanged for anyone who
 * never signs in — no skeleton, no empty heading, no gap. The rails are spaced
 * with margins rather than a flex gap precisely so a row that renders nothing
 * collapses instead of leaving a hole.
 *
 * Like the Top 10 rows it claims its titles and never drops them. A watchlist is
 * a list the viewer built by hand; silently hiding the film they added this
 * morning because a discover row happened to show it would look like the app
 * losing their data.
 */
export function WatchlistRail({ order }: { order: number }) {
  const { account } = useAccount();
  const accountId = account?.accountId ?? 0;

  // Two lists, because TMDB keeps films and series apart. `created_at.desc` puts
  // what they added last at the front, which is the order a watchlist is read in.
  const movies = useQuery({
    ...getWatchlistMoviesQuery({ variables: { account_id: accountId, sort_by: "created_at.desc" } }),
    enabled: Boolean(account),
    staleTime: 60_000,
    retry: false,
  });
  const shows = useQuery({
    ...getWatchlistTvQuery({ variables: { account_id: accountId, sort_by: "created_at.desc" } }),
    enabled: Boolean(account),
    staleTime: 60_000,
    retry: false,
  });

  // Interleaved rather than films-then-series: the two requests are separate only
  // because TMDB splits them, and the viewer thinks of one list.
  const items = useMemo(() => {
    const films = (movies.data?.results ?? []).map((item) => ({ ...item, media_type: MediaType.movie }));
    const series = (shows.data?.results ?? []).map((item) => ({ ...item, media_type: MediaType.tv }));
    return [...films, ...series].filter((item) => item.poster_path).slice(0, 20);
  }, [movies.data, shows.data]);

  useClaimItems(order, MediaType.movie, items);

  if (!account) return null;
  // No skeleton: this row's absence is normal (an empty watchlist), so a
  // placeholder that resolves to nothing would be a promise the page cannot keep.
  if (items.length === 0) return null;

  return <MediaRail title="Your watchlist" href="/my/watchlist" items={items} />;
}
