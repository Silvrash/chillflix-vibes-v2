import type { Preset } from "@/lib/presets";
import { MediaType } from "./queries";

/**
 * The user-facing discovery filter state. This is the single source of truth
 * used by BOTH the server (to prefetch + dehydrate) and the client (React Query
 * hooks). As long as both build their discover variables from the same
 * FilterState via `filterStateToParams`, the query keys match and the first
 * grid hydrates without a refetch.
 *
 * Preset params that have no dedicated control (region, certification, popularity
 * bounds, vote_count.lte, …) are carried in `extra` so curated presets keep
 * working even after the user tweaks a visible control.
 */
export interface FilterState {
  genres: number[];
  sortBy: string;
  yearMin?: number;
  yearMax?: number;
  minRating?: number;
  minVotes?: number;
  language?: string;
  extra?: Record<string, string | number>;
}

export interface Option<T extends string | number = string> {
  label: string;
  value: T;
}

const CURRENT_YEAR = new Date().getFullYear();

export const MOVIE_SORT_OPTIONS: Option[] = [
  { label: "Most popular", value: "popularity.desc" },
  { label: "Top rated", value: "vote_average.desc" },
  { label: "Newest first", value: "primary_release_date.desc" },
  { label: "Oldest first", value: "primary_release_date.asc" },
  { label: "Highest revenue", value: "revenue.desc" },
  { label: "Most voted", value: "vote_count.desc" },
  { label: "Title (A–Z)", value: "original_title.asc" },
];

export const TV_SORT_OPTIONS: Option[] = [
  { label: "Most popular", value: "popularity.desc" },
  { label: "Top rated", value: "vote_average.desc" },
  { label: "Newest first", value: "first_air_date.desc" },
  { label: "Oldest first", value: "first_air_date.asc" },
  { label: "Most voted", value: "vote_count.desc" },
  { label: "Name (A–Z)", value: "name.asc" },
];

export function sortOptionsFor(mediaType: MediaType): Option[] {
  return mediaType === MediaType.movie ? MOVIE_SORT_OPTIONS : TV_SORT_OPTIONS;
}

export const LANGUAGE_OPTIONS: Option[] = [
  { label: "Any language", value: "" },
  { label: "English", value: "en" },
  { label: "Japanese", value: "ja" },
  { label: "Korean", value: "ko" },
  { label: "Chinese", value: "zh" },
  { label: "Hindi", value: "hi" },
  { label: "Spanish", value: "es" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Italian", value: "it" },
  { label: "Portuguese", value: "pt" },
  { label: "Russian", value: "ru" },
  { label: "Turkish", value: "tr" },
];

export const RATING_OPTIONS: Option<number>[] = [
  { label: "Any rating", value: 0 },
  { label: "5+", value: 5 },
  { label: "6+", value: 6 },
  { label: "7+", value: 7 },
  { label: "8+", value: 8 },
  { label: "9+", value: 9 },
];

export const YEAR_OPTIONS: Option<number>[] = Array.from({ length: CURRENT_YEAR - 1949 }, (_, i) => {
  const year = CURRENT_YEAR - i;
  return { label: String(year), value: year };
});

export const DEFAULT_SORT = "popularity.desc";

export function emptyFilters(): FilterState {
  return { genres: [], sortBy: DEFAULT_SORT, extra: {} };
}

function yearOf(value: string | number | boolean): number | undefined {
  const year = parseInt(String(value).slice(0, 4), 10);
  return Number.isNaN(year) ? undefined : year;
}

/**
 * Map a curated preset onto the FilterState controls. Anything without a
 * dedicated control rides along in `extra`.
 */
export function presetToFilterState(preset: Preset): FilterState {
  const state: FilterState = { genres: [], sortBy: DEFAULT_SORT, extra: {} };

  for (const [key, value] of Object.entries(preset.filters)) {
    switch (key) {
      case "with_genres":
        state.genres = String(value)
          .split(",")
          .map(Number)
          .filter((n) => !Number.isNaN(n));
        break;
      case "sort_by":
        state.sortBy = String(value);
        break;
      case "with_original_language":
        state.language = String(value);
        break;
      case "vote_average.gte":
        state.minRating = Number(value);
        break;
      case "vote_count.gte":
        state.minVotes = Number(value);
        break;
      case "primary_release_date.gte":
      case "first_air_date.gte":
        state.yearMin = yearOf(value);
        break;
      case "primary_release_date.lte":
      case "first_air_date.lte":
        state.yearMax = yearOf(value);
        break;
      default:
        state.extra![key] = value as string | number;
    }
  }

  return state;
}

/**
 * Serialize FilterState into TMDB `/discover` query params (the React Query
 * `variables`). Emits the correct dotted keys per media type and omits empties.
 * NOTE: `page` is intentionally excluded — the infinite query adds it.
 */
export function filterStateToParams(
  state: FilterState,
  mediaType: MediaType,
  animeOnly?: boolean,
): Record<string, string | number | boolean> {
  const isMovie = mediaType === MediaType.movie;
  const params: Record<string, string | number | boolean> = { include_adult: false };

  const genres = [...state.genres];
  if (animeOnly && !genres.includes(16)) genres.unshift(16);
  if (genres.length) params.with_genres = genres.join(",");

  params.sort_by = state.sortBy || DEFAULT_SORT;

  const dateKey = isMovie ? "primary_release_date" : "first_air_date";
  if (state.yearMin) params[`${dateKey}.gte`] = `${state.yearMin}-01-01`;
  if (state.yearMax) params[`${dateKey}.lte`] = `${state.yearMax}-12-31`;

  if (state.minRating && state.minRating > 0) {
    params["vote_average.gte"] = state.minRating;
    // A vote floor keeps a high min-rating from surfacing obscure one-vote titles.
    params["vote_count.gte"] = state.minVotes ?? 50;
  } else if (state.minVotes) {
    params["vote_count.gte"] = state.minVotes;
  }

  const language = state.language || (animeOnly ? "ja" : "");
  if (language) params.with_original_language = language;

  if (state.extra) {
    for (const [key, value] of Object.entries(state.extra)) {
      if (value === undefined || value === null || value === "") continue;
      params[key] = value;
    }
  }

  return params;
}

/** Whether the state differs from a clean slate (used to show a Reset button). */
export function hasActiveFilters(state: FilterState, animeOnly?: boolean): boolean {
  return Boolean(
    state.genres.filter((g) => !(animeOnly && g === 16)).length ||
    state.yearMin ||
    state.yearMax ||
    (state.minRating && state.minRating > 0) ||
    state.language ||
    (state.extra && Object.keys(state.extra).length) ||
    state.sortBy !== DEFAULT_SORT,
  );
}
