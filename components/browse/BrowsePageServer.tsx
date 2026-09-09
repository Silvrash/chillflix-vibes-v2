import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createLoader, parseAsBoolean } from "nuqs/server";
import { BrowsePage } from "./BrowsePage";
import { makeQueryClient } from "@/lib/tmdb/query-client";
import { discover, getGenres } from "@/lib/tmdb/server";
import { emptyFilters, filterStateToParams, presetToFilterState } from "@/lib/tmdb/filters";
import { loadFilters, valuesToFilterState } from "@/lib/tmdb/filter-params";
import type { Preset } from "@/lib/presets";
import { GetDiscoverMoviesQueryKey, GetDiscoverTVShowsQueryKey, MediaType, type DiscoverMovieResponse } from "@/lib/tmdb/queries";

interface BrowsePageServerProps {
  mediaType: MediaType;
  presets: Preset[];
  animeOnly?: boolean;
  searchParams: Record<string, string | string[] | undefined>;
}

// The marker BrowsePage writes when the user empties the filters on purpose (see
// the note there). Its parser is spelled out again rather than imported, because
// a Server Component may only reach across a "use client" boundary for
// components — keep the two spellings in step.
const loadShowAll = createLoader({ all: parseAsBoolean.withDefault(false) });

/**
 * Server Component that resolves the filters from the URL, prefetches the
 * matching discover page on the server (from the cached data layer) and
 * dehydrates it into the React Query cache. The client <BrowsePage> reads the
 * same URL via nuqs, so SSR and the client agree and the grid renders without a
 * spinner — even on a shared/returned filtered URL.
 *
 * "Agree" includes the filters a page cannot use: the media type goes into
 * `valuesToFilterState` so a film URL carrying a TV-only network filter loses it
 * here exactly as it does on the client. Resolved without it, this would prefetch
 * a page under a query key the client never asks for — an empty grid on first
 * paint, and a dehydrated discover response nothing reads.
 */
export async function BrowsePageServer({ mediaType, presets, animeOnly, searchParams }: BrowsePageServerProps) {
  const isMovie = mediaType === MediaType.movie;
  const values = loadFilters(searchParams);
  const { all: showAll } = loadShowAll(searchParams);
  const initialFilters = valuesToFilterState(values, showAll ? emptyFilters() : presetToFilterState(presets[0]), mediaType);
  const discoverVariables = filterStateToParams(initialFilters, mediaType, animeOnly);

  const discoverKey = isMovie ? GetDiscoverMoviesQueryKey : GetDiscoverTVShowsQueryKey;

  const queryClient = makeQueryClient();

  // A `?q=` URL renders the search results instead of the grid, and search runs
  // client-side only — prefetching discover there would block the response on a
  // page nobody reads.
  const discoverPrefetch = values.q.trim()
    ? Promise.resolve()
    : queryClient.prefetchInfiniteQuery({
        queryKey: [discoverKey, discoverVariables],
        queryFn: ({ pageParam }) =>
          discover<DiscoverMovieResponse>(mediaType, { ...discoverVariables, page: pageParam as number }),
        initialPageParam: 1,
      });

  const [genresResult] = await Promise.all([getGenres(mediaType).catch(() => ({ genres: [] })), discoverPrefetch]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BrowsePage
        mediaType={mediaType}
        presets={presets}
        genres={genresResult.genres}
        initialFilters={initialFilters}
        animeOnly={animeOnly}
      />
    </HydrationBoundary>
  );
}
