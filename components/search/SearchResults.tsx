"use client";

import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";
import { MediaRail } from "@/components/media/MediaRail";
import { Spinner } from "@/components/ui/Spinner";
import type { SearchResult } from "./search-queries";
import { SearchResultCard } from "./SearchResultCard";
import { SearchScopeChips } from "./SearchScopeChips";
import { TopResultCard } from "./TopResultCard";
import type { SearchResultsState, SearchScope, SeeAllDestination } from "./useSearchResults";

export interface SearchResultsProps {
  state: SearchResultsState;
  scope: SearchScope;
  onScopeChange: (scope: SearchScope) => void;
  onNavigate: () => void;
  /** The browse page holding everything past the one page of each type shown here. */
  seeAll: SeeAllDestination;
}

export function SearchResults({ state, scope, onScopeChange, onNavigate, seeAll }: SearchResultsProps) {
  const showMovies = scope === "all" || scope === "movie";
  const showShows = scope === "all" || scope === "tv";
  const showPeople = scope === "all" || scope === "person";

  const movies = showMovies ? state.movies : [];
  const shows = showShows ? state.shows : [];
  const people = showPeople ? state.people : [];
  const visible = movies.length + shows.length + people.length;

  // What TMDB matched, not what fits on this screen: these rails hold one page per type, and the
  // hand-off below is what leads to the remainder.
  const matched =
    (showMovies ? state.totals.movie : 0) + (showShows ? state.totals.tv : 0) + (showPeople ? state.totals.person : 0);

  if (state.isPending) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (state.isError && visible === 0) {
    return <p className="py-24 text-center text-sm text-muted">Search is unavailable right now. Try again in a moment.</p>;
  }

  if (visible === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center sm:py-24">
        <SearchX className="h-8 w-8 text-muted" />
        <h2 className="mt-4 text-xl font-bold">No results for “{state.term}”</h2>
        <p className="mt-2 max-w-sm text-sm text-muted">Check the spelling, or try a shorter title.</p>
        <SearchScopeChips className="mt-6 justify-center" scope={scope} onScopeChange={onScopeChange} counts={state.totals} />
      </div>
    );
  }

  // The top result is already featured above; leaving it in its rail just prints it twice.
  const top = state.topResult;
  const withoutTop = (results: SearchResult[]) =>
    top ? results.filter((result) => !(result.id === top.id && result.kind === top.kind)) : results;

  // Shared so the three rows cannot drift apart. The cards are SearchResultCard rather than the
  // rail's default for the reason that component's own doc gives.
  const rail = {
    variant: "compact" as const,
    className: "mt-10",
    renderItem: (result: SearchResult) => <SearchResultCard result={result} onNavigate={onNavigate} />,
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchScopeChips scope={scope} onScopeChange={onScopeChange} counts={state.totals} />
        {/* Results arrive without a page change, so this line is what announces them. */}
        <p aria-live="polite" className="text-sm text-muted">
          {matched.toLocaleString("en-US")} result{matched === 1 ? "" : "s"} for “{state.term}”
        </p>
      </div>

      {state.topResult && (
        <div className="mt-6">
          <TopResultCard result={state.topResult} onNavigate={onNavigate} />
        </div>
      )}

      <MediaRail title="Movies" items={withoutTop(movies)} {...rail} />
      <MediaRail title="Shows" items={withoutTop(shows)} {...rail} />
      <MediaRail title="People" items={withoutTop(people)} {...rail} />

      <div className="mt-10 border-t border-white/10 pt-6">
        <Link
          href={seeAll.href}
          prefetch={false}
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-xl transition-colors hover:bg-white/20"
        >
          {seeAll.label}
          <span className="sr-only"> for “{state.term}”</span>
          <ArrowRight className="h-4 w-4" />
          <kbd className="ml-1 hidden rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted sm:inline">
            Enter
          </kbd>
        </Link>
      </div>
    </>
  );
}
