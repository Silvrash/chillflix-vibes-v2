import { createLoader, parseAsArrayOf, parseAsFloat, parseAsInteger, parseAsJson, parseAsString } from "nuqs/server";
import { DEFAULT_SORT, type FilterState } from "./filters";

/**
 * Single set of nuqs parsers shared by the client hook (BrowsePage's
 * `useQueryStates`) and the server loader (`loadFilters` in BrowsePageServer),
 * so SSR and the client agree on the filters parsed from the query string.
 *
 * `extra` carries preset-only params (region, certification, popularity bounds…)
 * as JSON so curated presets round-trip through the URL faithfully.
 */
export const filterParsers = {
  q: parseAsString.withDefault(""),
  genres: parseAsArrayOf(parseAsInteger).withDefault([]),
  sort: parseAsString.withDefault(DEFAULT_SORT),
  yearFrom: parseAsInteger,
  yearTo: parseAsInteger,
  minRating: parseAsFloat,
  minVotes: parseAsInteger,
  lang: parseAsString.withDefault(""),
  extra: parseAsJson((value) => (value ?? {}) as Record<string, string | number>).withDefault({}),
};

export const loadFilters = createLoader(filterParsers);

export interface FilterValues {
  q: string;
  genres: number[];
  sort: string;
  yearFrom: number | null;
  yearTo: number | null;
  minRating: number | null;
  minVotes: number | null;
  lang: string;
  extra: Record<string, string | number>;
}

/** Whether the URL carries no discovery filters (search `q` is ignored here). */
function hasNoFilters(v: FilterValues): boolean {
  return (
    v.genres.length === 0 &&
    v.sort === DEFAULT_SORT &&
    v.yearFrom == null &&
    v.yearTo == null &&
    v.minRating == null &&
    v.minVotes == null &&
    !v.lang &&
    Object.keys(v.extra ?? {}).length === 0
  );
}

/** Build a FilterState from URL values; falls back to `fallback` when the URL has no filters. */
export function valuesToFilterState(v: FilterValues, fallback: FilterState): FilterState {
  if (hasNoFilters(v)) return fallback;
  return {
    genres: v.genres,
    sortBy: v.sort || DEFAULT_SORT,
    yearMin: v.yearFrom ?? undefined,
    yearMax: v.yearTo ?? undefined,
    minRating: v.minRating ?? undefined,
    minVotes: v.minVotes ?? undefined,
    language: v.lang || undefined,
    extra: v.extra ?? {},
  };
}

/** Serialize a FilterState into URL values (nuqs clears values equal to their default). */
export function filterStateToValues(s: FilterState): Omit<FilterValues, "q"> {
  return {
    genres: s.genres,
    sort: s.sortBy || DEFAULT_SORT,
    yearFrom: s.yearMin ?? null,
    yearTo: s.yearMax ?? null,
    minRating: s.minRating ?? null,
    minVotes: s.minVotes ?? null,
    lang: s.language || "",
    extra: s.extra && Object.keys(s.extra).length ? s.extra : {},
  };
}
