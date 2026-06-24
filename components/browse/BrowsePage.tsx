"use client";

import { useCallback, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { Hero } from "./Hero";
import { FilterBar, type Genre } from "./FilterBar";
import { SearchBar } from "./SearchBar";
import { MediaGrid } from "@/components/media/MediaGrid";
import { filterStateToParams, type FilterState } from "@/lib/tmdb/filters";
import { filterParsers, filterStateToValues, valuesToFilterState } from "@/lib/tmdb/filter-params";
import type { Preset } from "@/lib/presets";
import {
  MediaType,
  type Movie,
  type TVShow,
  getDiscoverMoviesInfiniteQuery,
  getDiscoverTVShowsInfiniteQuery,
  getSearchMoviesInfiniteQuery,
  getSearchTVSeriesInfiniteQuery,
} from "@/lib/tmdb/queries";

interface BrowsePageProps {
  mediaType: MediaType;
  presets: Preset[];
  genres: Genre[];
  initialFilters: FilterState;
  animeOnly?: boolean;
}

const infinitePageParams = {
  initialPageParam: 1,
  getNextPageParam: (lastPage: { page: number; total_pages: number }) =>
    lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
};

export function BrowsePage({ mediaType, presets, genres, initialFilters, animeOnly }: BrowsePageProps) {
  // Filters + search live in the URL (nuqs), so they survive navigating into a
  // title and coming back, and are shareable. `initialFilters` is the server's
  // URL-resolved fallback used when the query string carries no filters.
  const [values, setValues] = useQueryStates(filterParsers);
  const q = values.q;

  const filters = useMemo(() => valuesToFilterState(values, initialFilters), [values, initialFilters]);
  const setFilters = useCallback((next: FilterState) => void setValues(filterStateToValues(next)), [setValues]);
  const setQuery = useCallback((next: string) => void setValues({ q: next || null }), [setValues]);

  const isMovie = mediaType === MediaType.movie;
  const searching = q.trim().length > 0;

  // Same builder the server used to prefetch, so the first page hydrates.
  const discoverVariables = useMemo(() => filterStateToParams(filters, mediaType, animeOnly), [filters, mediaType, animeOnly]);

  // The movie/TV factories return differently-typed option objects that
  // `useInfiniteQuery` can't unify across a ternary, so we normalise to one
  // concrete option type — the merged results are cast to (Movie | TVShow)[].
  const discoverOptions = (
    isMovie
      ? getDiscoverMoviesInfiniteQuery({ enabled: !searching, variables: discoverVariables as any, ...infinitePageParams })
      : getDiscoverTVShowsInfiniteQuery({ enabled: !searching, variables: discoverVariables as any, ...infinitePageParams })
  ) as ReturnType<typeof getDiscoverMoviesInfiniteQuery>;

  const searchOptions = (
    isMovie
      ? getSearchMoviesInfiniteQuery({
          enabled: searching,
          variables: { query: q, include_adult: false } as any,
          ...infinitePageParams,
        })
      : getSearchTVSeriesInfiniteQuery({
          enabled: searching,
          variables: { query: q, include_adult: false } as any,
          ...infinitePageParams,
        })
  ) as ReturnType<typeof getSearchMoviesInfiniteQuery>;

  const discover = useInfiniteQuery(discoverOptions);
  const search = useInfiniteQuery(searchOptions);

  const active = searching ? search : discover;

  const items = useMemo(() => (active.data?.pages.flatMap((page) => page.results) ?? []) as (Movie | TVShow)[], [active.data]);

  return (
    <div>
      {!searching && <Hero mediaType={mediaType} animeOnly={animeOnly} />}

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-10">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-bold">{animeOnly ? "Anime" : isMovie ? "Movies" : "TV Shows"}</h1>
            <SearchBar
              placeholder={`Search ${animeOnly ? "Anime" : isMovie ? "Movies" : "TV Shows"}`}
              onSearch={setQuery}
              initialValue={q}
            />
          </div>

          {searching ? (
            <h2 className="text-lg font-semibold">
              Results for <span className="text-primary">&ldquo;{q}&rdquo;</span>
            </h2>
          ) : (
            <FilterBar
              mediaType={mediaType}
              animeOnly={animeOnly}
              genres={genres}
              presets={presets}
              filters={filters}
              onChange={setFilters}
            />
          )}
        </div>

        <MediaGrid
          items={items}
          isLoading={active.isLoading}
          isFetchingNextPage={active.isFetchingNextPage}
          hasNextPage={!!active.hasNextPage}
          onLoadMore={active.fetchNextPage}
        />
      </div>
    </div>
  );
}
