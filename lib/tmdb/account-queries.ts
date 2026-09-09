import { deleteMutation, getQuery, postMutation } from "./hooks";
import type { MediaType, Movie, TVShow } from "./queries";

/**
 * The signed-in half of the TMDB API.
 *
 * Declared here rather than in `queries.ts` for the same reason
 * `components/search/search-queries.ts` is: that file is the generated
 * catalogue of public endpoints, and these are neither generated nor public.
 * Every one of them routes through `ACCOUNT_PROXY` instead of the default, so
 * the credentialed, uncacheable proxy is reached rather than the shared one.
 */
const ACCOUNT_PROXY = "/api/account/tmdb";

/** Whether this viewer has favourited, watchlisted or rated one title. */
export interface AccountStates {
  id: number;
  favorite: boolean;
  watchlist: boolean;
  rated: false | { value: number };
}

export interface PagedResults<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

/** TMDB answers every account write with this, whatever the endpoint. */
export interface StatusResponse {
  success?: boolean;
  status_code: number;
  status_message: string;
}

/**
 * Per-title state, and the one account endpoint that cannot ride the detail
 * page's server prefetch: `app/media/[type]/[id]/page.tsx` is `revalidate =
 * 86400`, so anything appended there is cached for a day and shared by every
 * visitor. It has to be a separate client query.
 *
 * `account_id` is not a parameter TMDB wants — it is passed so the React Query
 * key is account-scoped. Without it the key is `[path, { session-less }]` and
 * one viewer's answer would be served to the next from the singleton cache.
 */
export const GetAccountStatesQueryKey = "/[media_type]/[media_id]/account_states";
export const getAccountStatesQuery = getQuery<AccountStates, { media_type: MediaType; media_id: number; account_id: number }>(
  GetAccountStatesQueryKey,
  ACCOUNT_PROXY,
);

export const GetWatchlistMoviesQueryKey = "/account/[account_id]/watchlist/movies";
export const getWatchlistMoviesQuery = getQuery<PagedResults<Movie>, { account_id: number; sort_by?: string; page?: number }>(
  GetWatchlistMoviesQueryKey,
  ACCOUNT_PROXY,
);

export const GetWatchlistTvQueryKey = "/account/[account_id]/watchlist/tv";
export const getWatchlistTvQuery = getQuery<PagedResults<TVShow>, { account_id: number; sort_by?: string; page?: number }>(
  GetWatchlistTvQueryKey,
  ACCOUNT_PROXY,
);

export const GetFavoriteMoviesQueryKey = "/account/[account_id]/favorite/movies";
export const getFavoriteMoviesQuery = getQuery<PagedResults<Movie>, { account_id: number; sort_by?: string; page?: number }>(
  GetFavoriteMoviesQueryKey,
  ACCOUNT_PROXY,
);

export const GetFavoriteTvQueryKey = "/account/[account_id]/favorite/tv";
export const getFavoriteTvQuery = getQuery<PagedResults<TVShow>, { account_id: number; sort_by?: string; page?: number }>(
  GetFavoriteTvQueryKey,
  ACCOUNT_PROXY,
);

/**
 * Both writes are POST with a boolean, not separate add/remove verbs — TMDB
 * models them as "set this flag", which is also why one mutation covers adding
 * and removing.
 */
export const AddToWatchlistKey = "/account/[account_id]/watchlist";
export const addToWatchlistMutation = postMutation<
  StatusResponse,
  { account_id: number; media_type: MediaType; media_id: number; watchlist: boolean }
>(AddToWatchlistKey, ACCOUNT_PROXY);

export const SetFavoriteKey = "/account/[account_id]/favorite";
export const setFavoriteMutation = postMutation<
  StatusResponse,
  { account_id: number; media_type: MediaType; media_id: number; favorite: boolean }
>(SetFavoriteKey, ACCOUNT_PROXY);

export const GetRatedMoviesQueryKey = "/account/[account_id]/rated/movies";
export const getRatedMoviesQuery = getQuery<PagedResults<Movie>, { account_id: number; sort_by?: string; page?: number }>(
  GetRatedMoviesQueryKey,
  ACCOUNT_PROXY,
);

export const GetRatedTvQueryKey = "/account/[account_id]/rated/tv";
export const getRatedTvQuery = getQuery<PagedResults<TVShow>, { account_id: number; sort_by?: string; page?: number }>(
  GetRatedTvQueryKey,
  ACCOUNT_PROXY,
);

/**
 * Rating is the one account write with two verbs: POST sets a score, DELETE
 * clears it. TMDB has no "unrated" value to post — 0 is rejected — so removing
 * a rating is genuinely a different request rather than a different body.
 *
 * No `account_id` here, unlike the watchlist and favourite writes. It is not in
 * the path — TMDB takes the rating against the title and reads the account from
 * the session — and a mutation has no query key to scope, so passing it would
 * only add a field to the request body that TMDB never asked for. The two path
 * params are consumed by the path; whatever is left is the body.
 */
export const SetRatingKey = "/[media_type]/[media_id]/rating";
export const setRatingMutation = postMutation<StatusResponse, { media_type: MediaType; media_id: number; value: number }>(
  SetRatingKey,
  ACCOUNT_PROXY,
);

export const clearRatingMutation = deleteMutation<StatusResponse, { media_type: MediaType; media_id: number }>(
  SetRatingKey,
  ACCOUNT_PROXY,
);

/** Every account query key, for clearing the lot when the viewer changes. */
export const ACCOUNT_QUERY_KEYS = [
  GetAccountStatesQueryKey,
  GetWatchlistMoviesQueryKey,
  GetWatchlistTvQueryKey,
  GetFavoriteMoviesQueryKey,
  GetFavoriteTvQueryKey,
  GetRatedMoviesQueryKey,
  GetRatedTvQueryKey,
];
