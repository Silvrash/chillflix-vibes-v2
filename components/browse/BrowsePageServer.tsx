import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { BrowsePage } from "./BrowsePage";
import { makeQueryClient } from "@/lib/tmdb/query-client";
import { discover, getGenres, getTrending } from "@/lib/tmdb/server";
import { filterStateToParams, presetToFilterState } from "@/lib/tmdb/filters";
import { loadFilters, valuesToFilterState } from "@/lib/tmdb/filter-params";
import type { Preset } from "@/lib/presets";
import {
  GetDiscoverMoviesQueryKey,
  GetDiscoverTVShowsQueryKey,
  GetTrendingMoviesQueryKey,
  GetTrendingTVShowsQueryKey,
  MediaType,
  type DiscoverMovieResponse,
  type TrendingResponse,
} from "@/lib/tmdb/queries";

interface BrowsePageServerProps {
  mediaType: MediaType;
  presets: Preset[];
  animeOnly?: boolean;
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Server Component that resolves the filters from the URL, prefetches the hero
 * (trending) + matching discover page on the server (from the cached data
 * layer), and dehydrates them into the React Query cache. The client
 * <BrowsePage> reads the same URL via nuqs, so SSR and the client agree and the
 * grid renders without a spinner — even on a shared/returned filtered URL.
 */
export async function BrowsePageServer({ mediaType, presets, animeOnly, searchParams }: BrowsePageServerProps) {
  const isMovie = mediaType === MediaType.movie;
  const defaultFilters = presetToFilterState(presets[0]);
  const initialFilters = valuesToFilterState(loadFilters(searchParams), defaultFilters);
  const discoverVariables = filterStateToParams(initialFilters, mediaType, animeOnly);

  const trendingKey = isMovie ? GetTrendingMoviesQueryKey : GetTrendingTVShowsQueryKey;
  const discoverKey = isMovie ? GetDiscoverMoviesQueryKey : GetDiscoverTVShowsQueryKey;

  const queryClient = makeQueryClient();

  const [genresResult] = await Promise.all([
    getGenres(mediaType).catch(() => ({ genres: [] })),
    queryClient.prefetchQuery({
      queryKey: [trendingKey, { time_window: "day" }],
      queryFn: () => getTrending<TrendingResponse>(mediaType, "day"),
    }),
    queryClient.prefetchInfiniteQuery({
      queryKey: [discoverKey, discoverVariables],
      queryFn: ({ pageParam }) => discover<DiscoverMovieResponse>(mediaType, { ...discoverVariables, page: pageParam as number }),
      initialPageParam: 1,
    }),
  ]);

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
