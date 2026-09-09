"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createSerializer, parseAsBoolean, useQueryStates } from "nuqs";
import { X } from "lucide-react";
import { BrowseCategoryPicker, BrowseSidebar } from "./BrowseSidebar";
import { FilterBar } from "./FilterBar";
import { MediaGrid } from "@/components/media/MediaGrid";
import { emptyFilters, filterStateToParams, type FilterState } from "@/lib/tmdb/filters";
import {
  browseHeading,
  filterParsers,
  filterStateToValues,
  valuesToFilterState,
  type FilterValues,
} from "@/lib/tmdb/filter-params";
import { networkFromExtra } from "@/lib/networks";
import { SITE_NAME } from "@/lib/seo";
import type { Preset } from "@/lib/presets";
import {
  MediaType,
  type Genre,
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

const SUBTITLES = {
  movie: "Browse the film catalogue by category, genre and era.",
  tv: "Browse the series catalogue by category, genre and era.",
  anime: "Browse Japanese animated series by category, genre and era.",
};

/**
 * `all` marks a selection the user emptied on purpose.
 *
 * nuqs strips every value that equals its parser default, so "no category, no
 * genres, no filters" leaves a bare /movies behind — byte-identical to the URL
 * that means "nothing chosen yet", which falls back to the first preset. Without
 * this marker, untoggling your last genre would teleport you into another
 * category instead of widening the results.
 *
 * BrowsePageServer reads the same key so SSR resolves the same filters.
 */
const browseParsers = { ...filterParsers, all: parseAsBoolean.withDefault(false) };

const serializeFilters = createSerializer(filterParsers);

/** Whether a selection would leave no trace in the URL — asked of nuqs' own serializer. */
function leavesUrlEmpty(values: Omit<FilterValues, "q">): boolean {
  return serializeFilters(values) === "";
}

export function BrowsePage({ mediaType, presets, genres, initialFilters, animeOnly }: BrowsePageProps) {
  // Filters + search live in the URL (nuqs), so they survive navigating into a
  // title and coming back, and are shareable. `initialFilters` is the server's
  // URL-resolved fallback used when the query string carries no filters.
  const [values, setValues] = useQueryStates(browseParsers);
  const q = values.q;

  const isMovie = mediaType === MediaType.movie;

  // Resolved through the same function the server used, media type and all, so a filter this page
  // cannot use is dropped identically on both sides and the discover key still matches.
  const filters = useMemo(
    () => valuesToFilterState(values, values.all ? emptyFilters() : initialFilters, mediaType),
    [values, initialFilters, mediaType],
  );

  // Narrowing the catalogue is navigation, so it defaults to a history entry the
  // Back button can undo — nuqs would otherwise replace, leaving a three-step
  // browse session with nothing behind it but the page you arrived from. Callers
  // that edit one setting repeatedly (the filter sheet) ask for "replace" so a
  // single visit there stays a single step back.
  const setFilters = useCallback(
    (next: FilterState, history: "push" | "replace" = "push") => {
      const serialized = filterStateToValues(next);
      // The marker is only meaningful while nothing else survives serialization,
      // and has to go the moment something does: left behind, it would swallow
      // the preset fallback on the next empty URL.
      void setValues({ ...serialized, all: leavesUrlEmpty(serialized) || null }, { history });
    },
    [setValues],
  );

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

  // The paginated destination of the search overlay: the overlay caps at TMDB
  // page 1 per type, so "See all results" (and a bare Enter) hands the query
  // over here as `?q=`, where it scrolls through every page TMDB has.
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

  const section = animeOnly ? "Anime" : isMovie ? "Movies" : "TV Shows";
  // What a search here really returns, which on /anime is not this section: TMDB's search endpoints
  // take no filters, so the anime page searches the whole series catalogue (see SEARCH_SCOPE in
  // lib/tmdb/filter-params.ts, where the shared card and canonical say the same thing). Naming the
  // section instead put "Matching anime" over results that were nothing of the kind.
  // "TV Shows" mid-sentence is "TV shows": an acronym keeps its case, so the running-text spelling
  // is written out rather than lowercased out of the heading above.
  const searchedInProse = isMovie ? "movies" : "TV shows";

  // A network is the one filter that renames the page. Arriving from the home page's network row on
  // a page still headed "TV Shows", the only thing saying which network you picked would be a chip
  // among the chips — so the heading answers it, and the line under it says what the filter means
  // (series TMDB credits to that network) and, by naming series, why no film page ever shows one.
  const network = searching ? undefined : networkFromExtra(filters.extra);
  const heading = browseHeading(q, filters, section);
  const subtitle = searching
    ? `Matching ${searchedInProse} from the catalogue.`
    : network
      ? `${animeOnly ? "Anime" : "Series"} credited to ${network.name} by TMDB.`
      : SUBTITLES[animeOnly ? "anime" : isMovie ? "movie" : "tv"];

  // `generateMetadata` gave the tab this same name on the way in, but nuqs writes a filter change
  // into the URL shallowly — no navigation, so no second run — and the tab would otherwise keep
  // naming whatever was picked when the page was last really navigated to, over an <h1> that had
  // moved on. The suffix is the title template in app/layout.tsx, applied here by hand because a
  // client render cannot reach Next's metadata.
  useEffect(() => {
    document.title = `${heading} — ${SITE_NAME}`;
  }, [heading]);

  // Only shown once TMDB has answered — a "0 titles" pill during the first
  // fetch reads as an empty catalogue rather than as a page still loading.
  const total = active.data?.pages[0]?.total_results;
  const countLabel = typeof total === "number" && total > 0 ? `${total.toLocaleString("en-US")} titles` : null;

  const sidebarProps = { mediaType, animeOnly, presets, genres, filters, onChange: setFilters };

  return (
    // The navbar floats over the page, so the whole browse layout starts below it.
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-24 sm:px-6 sm:pt-28 lg:px-10">
      {/* The title leads the document. Inside the column below, its <h1> would
          follow the sidebar's <h2>s in the DOM on desktop, so a screen reader
          would meet "Categories" before the name of the page. */}
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading}</h1>
          {countLabel && (
            <span className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-muted">
              {countLabel}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </header>

      {/* `items-start` is what lets the sidebar stick: stretched to the row's full
          height it would have no travel to stick through. */}
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        {!searching && <BrowseSidebar {...sidebarProps} />}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {searching ? (
              // Search hides the category rail, so this is the only way back to
              // browsing that does not mean editing the address bar.
              <button
                type="button"
                onClick={() => void setValues({ q: null }, { history: "push" })}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold backdrop-blur-xl transition-colors hover:bg-white/15"
              >
                <X className="h-4 w-4 text-muted" />
                Clear search
              </button>
            ) : (
              <>
                <BrowseCategoryPicker {...sidebarProps} />
                <FilterBar mediaType={mediaType} filters={filters} onChange={setFilters} />
              </>
            )}
          </div>

          <MediaGrid
            className="mt-6"
            items={items}
            isLoading={active.isLoading}
            isFetchingNextPage={active.isFetchingNextPage}
            hasNextPage={!!active.hasNextPage}
            onLoadMore={active.fetchNextPage}
            emptyLabel={searching ? "No titles match that search" : "No titles match these filters"}
          />
        </div>
      </div>
    </div>
  );
}
