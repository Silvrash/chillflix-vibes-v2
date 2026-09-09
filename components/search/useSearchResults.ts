"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getSearchMoviesQuery, getSearchTVSeriesQuery } from "@/lib/tmdb/queries";
import {
  getSearchPeopleQuery,
  toMovieResult,
  toPersonResult,
  toShowResult,
  type SearchKind,
  type SearchResult,
} from "./search-queries";

export type SearchScope = "all" | SearchKind;

const DEBOUNCE_MS = 350;
const MIN_TERM_LENGTH = 2;
/** TMDB orders each list by relevance; ranking all sixty rows by popularity would float a famous
 *  unrelated title above the thing that was actually typed. */
const TOP_RESULT_WINDOW = 5;

export function useDebouncedValue<T>(value: T, delay = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export interface SearchResultsState {
  term: string;
  /** The field has moved on but the debounce has not fired yet. */
  isTyping: boolean;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  movies: SearchResult[];
  shows: SearchResult[];
  people: SearchResult[];
  /** How many TMDB holds of each type — not how many of them fit in this one page of rows. */
  totals: Record<SearchKind, number>;
  topResult: SearchResult | null;
  total: number;
}

export interface SeeAllDestination {
  href: string;
  label: string;
}

/**
 * The overlay never asks for more than page one of each type, so it needs somewhere to send you
 * for the rest: the browse pages page through the very same endpoints. `person` has no browse
 * route of its own, so it hands off to the default destination like `all` does.
 */
export function getSeeAllDestination(scope: SearchScope, term: string): SeeAllDestination {
  const shows = scope === "tv";
  return {
    href: `${shows ? "/tv" : "/movies"}?q=${encodeURIComponent(term)}`,
    label: shows ? "See all series results" : "See all movie results",
  };
}

export function useSearchResults(input: string, scope: SearchScope): SearchResultsState {
  const typed = input.trim();
  const term = useDebouncedValue(typed);
  const enabled = term.length >= MIN_TERM_LENGTH;

  // Three hooks in one render means three requests in flight at once. They all run whatever the
  // scope is, so switching chips filters what is already here instead of costing a round-trip.
  const movieQuery = useQuery(
    getSearchMoviesQuery({
      variables: { query: term, page: 1, include_adult: false },
      enabled,
      placeholderData: keepPreviousData,
    }),
  );
  const showQuery = useQuery(
    getSearchTVSeriesQuery({
      variables: { query: term, page: 1, include_adult: false },
      enabled,
      placeholderData: keepPreviousData,
    }),
  );
  const peopleQuery = useQuery(
    getSearchPeopleQuery({
      variables: { query: term, page: 1, include_adult: false },
      enabled,
      placeholderData: keepPreviousData,
    }),
  );

  const movies = useMemo(() => (enabled ? (movieQuery.data?.results ?? []).map(toMovieResult) : []), [enabled, movieQuery.data]);
  const shows = useMemo(() => (enabled ? (showQuery.data?.results ?? []).map(toShowResult) : []), [enabled, showQuery.data]);
  const people = useMemo(
    () => (enabled ? (peopleQuery.data?.results ?? []).map(toPersonResult) : []),
    [enabled, peopleQuery.data],
  );

  const totals = useMemo(
    () => ({
      movie: enabled ? (movieQuery.data?.total_results ?? 0) : 0,
      tv: enabled ? (showQuery.data?.total_results ?? 0) : 0,
      person: enabled ? (peopleQuery.data?.total_results ?? 0) : 0,
    }),
    [enabled, movieQuery.data, showQuery.data, peopleQuery.data],
  );

  // People are deliberately not candidates: there is no person route to send anyone to, so a
  // person in the headline slot is a card with no way out — and a headline actor's popularity
  // beats every film their name matches.
  const topResult = useMemo(() => {
    const candidates: SearchResult[] = [];
    if (scope === "all" || scope === "movie") candidates.push(...movies.slice(0, TOP_RESULT_WINDOW));
    if (scope === "all" || scope === "tv") candidates.push(...shows.slice(0, TOP_RESULT_WINDOW));

    const withArtwork = candidates.filter((result) => result.imagePath || result.backdropPath);
    if (!withArtwork.length) return null;
    return withArtwork.reduce((best, result) => (result.popularity > best.popularity ? result : best));
  }, [movies, shows, scope]);

  const hasData = Boolean(movieQuery.data || showQuery.data || peopleQuery.data);
  const isFetching = movieQuery.isFetching || showQuery.isFetching || peopleQuery.isFetching;

  return {
    term: enabled ? term : "",
    isTyping: typed !== term,
    // Keeping the previous page on screen means only the very first search gets a full spinner.
    isPending: enabled && isFetching && !hasData,
    isFetching,
    isError: movieQuery.isError && showQuery.isError && peopleQuery.isError,
    movies,
    shows,
    people,
    totals,
    topResult,
    total: totals.movie + totals.tv + totals.person,
  };
}
