"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "@/components/account";
import { MediaRail } from "@/components/media/MediaRail";
import { getRecommendedMoviesQuery, getRecommendedTvQuery } from "@/lib/tmdb/account-queries";
import { MediaType } from "@/lib/tmdb/queries";
import { interleave, withPoster } from "./rail-items";
import { useUnshownMixedItems } from "./shown-titles";

/**
 * What TMDB makes of what this viewer has rated and favourited.
 *
 * The second row on the page about them rather than about what is popular, and the one the rating
 * control pays for — TMDB computes it from their scores and their favourites, so it is empty until
 * they have marked something and sharpens as they mark more.
 *
 * Unlike the watchlist above it, this row gives titles up. A watchlist is a list the viewer built by
 * hand and hiding an entry would look like the app losing their data; a recommendation is drawn from
 * a pool of thousands, so dropping one the Top 10 already shows costs nothing and the row still
 * fills. That is the whole difference between claiming and yielding, and it is why this one reads
 * the registry rather than only writing to it.
 */
export function RecommendedRail({ order }: { order: number }) {
  const { account } = useAccount();
  // The v4 object id, not the numeric one the watchlist and favourites use — the recommendations
  // endpoints are the v4 half of the API and do not answer to the v3 identifier.
  const accountObjectId = account?.accountObjectId ?? "";

  const movies = useQuery({
    ...getRecommendedMoviesQuery({ variables: { account_object_id: accountObjectId } }),
    enabled: Boolean(accountObjectId),
    staleTime: 60_000,
    retry: false,
  });
  const shows = useQuery({
    ...getRecommendedTvQuery({ variables: { account_object_id: accountObjectId } }),
    enabled: Boolean(accountObjectId),
    staleTime: 60_000,
    retry: false,
  });

  // Stamped with the type each half came from. The documented schema says these items carry their
  // own `media_type`; the live API does not send one (lib/tmdb/account-queries.ts), and the row
  // draws both halves, so the endpoint that was called is the only reliable answer.
  //
  // `withPoster` is doing more than tidying here: this route has a history of answering with stub
  // items that carry an id and nothing else, and dropping the poster-less ones drops those too.
  const items = useMemo(() => {
    const films = withPoster(movies.data?.results ?? []).map((item) => ({ ...item, media_type: MediaType.movie }));
    const series = withPoster(shows.data?.results ?? []).map((item) => ({ ...item, media_type: MediaType.tv }));
    return interleave(films, series);
  }, [movies.data, shows.data]);

  const visible = useUnshownMixedItems(order, items, 20);

  if (!account) return null;
  // Nothing to apologise for and nothing to promise. An empty answer is the ordinary case, not a
  // failure — a new account has nothing to compute from, and TMDB sometimes returns nothing for a
  // well-stocked one — so the row collapses like the watchlist above it rather than leaving a
  // heading over a skeleton that resolves to nothing. A failed request lands here too, which is
  // deliberate: this route is known to answer 500 while its siblings are fine, and a home page that
  // breaks over a suggestion row would be a poor trade.
  if (visible.length === 0) return null;

  return <MediaRail title="Recommended for you" href="/my/recommendations" items={visible} />;
}
