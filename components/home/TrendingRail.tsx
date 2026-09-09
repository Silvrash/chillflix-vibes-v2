"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MediaRail, MediaRailSkeleton } from "@/components/media/MediaRail";
import { MediaType, TimeWindow, getTrendingMoviesQuery, getTrendingTVShowsQuery } from "@/lib/tmdb/queries";
import { TOP_N, topRanked } from "./rail-items";
import { useClaimItems } from "./shown-titles";

export interface TrendingRailProps {
  title: string;
  mediaType: MediaType;
  href?: string;
  /** This row's claim on a title two rows drew: lowest `order` keeps it. Not page position — see ./HomeRails.tsx. */
  order: number;
}

/**
 * A ranked Top 10 off today's trending list — the same query (and cache entry) the hero reads,
 * so the two of them cost one request between them and both arrive with the server-rendered HTML.
 *
 * It is the one row on the page that never dedupes. "Top 10" is a claim about TMDB's ranking, and a
 * row that gave up its #1 because some other row happened to be showing that film would go on
 * numbering whatever was left 1 through 10 — a badge saying the eleventh-most-watched film today is
 * the first. So it draws TMDB's ten and claims them ahead of every other row, the hero included;
 * the rows below work around it instead (./rail-items.ts, ./shown-titles.tsx).
 */
export function TrendingRail({ title, mediaType, href, order }: TrendingRailProps) {
  const queryFactory = mediaType === MediaType.movie ? getTrendingMoviesQuery : getTrendingTVShowsQuery;
  const query = useQuery(queryFactory({ variables: { time_window: TimeWindow.day } }));

  const items = useMemo(() => topRanked(query.data?.results ?? []), [query.data]);
  useClaimItems(order, mediaType, items);

  // A rail that can't load is left out rather than shown as an error: the page is still a page. It
  // is the absence of a response, not the error, that decides that — a refetch that fails once the
  // ten are on screen leaves them in `data`, and dropping the row then would empty it under a
  // visitor who is looking at it, while the hero reading this same cache entry carried on.
  if (query.isError && !query.data) return null;
  if (query.isPending) return <MediaRailSkeleton title={title} count={TOP_N} />;

  return <MediaRail title={title} href={href} items={items} ranked />;
}
