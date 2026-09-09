import { deleteMutation, getQuery, postMutation, putMutation } from "./hooks";
import type { MediaType, Movie, TrendingItem, TVShow } from "./queries";

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

/**
 * What TMDB thinks this viewer should watch next.
 *
 * The one account endpoint that is computed rather than stored. TMDB builds it
 * from what they have rated and what they have marked favourite — the watchlist
 * is not an input — so it is the payoff for the two controls above, and an
 * account that has done neither gets an empty page rather than an error. Empty
 * is a resting state here, not a failure: TMDB's own site has a "not enough
 * data" screen for it, and accounts with plenty of both have been observed
 * getting nothing back.
 *
 * Keyed by the v4 account *object* id and not by the numeric id every v3 path
 * above takes. They are two identifiers for one account and are not
 * interchangeable. It is opaque in the literal sense — TMDB's own example
 * contains a non-hex character — so it is passed through untouched and never
 * parsed or validated.
 *
 * No `sort_by`, although every sibling collection above accepts one. TMDB's own
 * ranking is the only order these have.
 *
 * The documented schema puts a `media_type` on every result. The live API does
 * not send one: checked against a real account, whose items came back carrying
 * an undocumented `softcore` flag and no `media_type` at all. So callers stamp
 * the type on from the endpoint they called rather than reading it off the item
 * — which is the right habit for this family regardless, since the favourites
 * and rated collections are documented without it too.
 */
export const GetRecommendedMoviesQueryKey = "/4/account/[account_object_id]/movie/recommendations";
export const getRecommendedMoviesQuery = getQuery<PagedResults<Movie>, { account_object_id: string; page?: number }>(
  GetRecommendedMoviesQueryKey,
  ACCOUNT_PROXY,
);

export const GetRecommendedTvQueryKey = "/4/account/[account_object_id]/tv/recommendations";
export const getRecommendedTvQuery = getQuery<PagedResults<TVShow>, { account_object_id: string; page?: number }>(
  GetRecommendedTvQueryKey,
  ACCOUNT_PROXY,
);

/**
 * Custom lists are v4 only as well, and for a different reason: v3's list
 * endpoints write against a different id space and cannot see a v4-created
 * list. So every path below starts `4/` too, and the proxy authenticates it
 * with the viewer's own access token rather than the app's.
 */

/** One of the viewer's lists, as `GET /4/account/{id}/lists` summarises it. */
export interface ListSummary {
  id: number;
  name: string;
  description: string;
  number_of_items: number;
  /**
   * 0 or 1 from the account listing but a real boolean from `GET /4/list/{id}`.
   * TMDB genuinely answers both shapes, so callers have to coerce.
   */
  public: number | boolean;
  iso_639_1: string;
  iso_3166_1: string;
  poster_path: string | null;
  backdrop_path: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A list's own page, which carries one page of its items inline rather than
 * offering a separate items endpoint.
 *
 * `results` is typed as `TrendingItem` because that is the shape TMDB returns
 * for a mixed movie-and-show payload — every item names its own `media_type` —
 * and it is what `MediaGrid` already accepts.
 */
export interface ListDetails {
  id: number;
  name: string;
  description: string;
  public: boolean;
  item_count: number;
  iso_639_1: string;
  iso_3166_1: string;
  poster_path: string | null;
  backdrop_path: string | null;
  results: TrendingItem[];
  page: number;
  total_pages: number;
  total_results: number;
}

/** `POST /4/list` answers with the new list's id alongside the usual status. */
export interface CreatedList extends StatusResponse {
  id: number;
}

/** Per-item outcome, because adding six titles can half succeed. */
export interface ListItemsResponse extends StatusResponse {
  results?: { media_type: MediaType; media_id: number; success: boolean }[];
}

export const GetAccountListsQueryKey = "/4/account/[account_object_id]/lists";
export const getAccountListsQuery = getQuery<PagedResults<ListSummary>, { account_object_id: string; page?: number }>(
  GetAccountListsQueryKey,
  ACCOUNT_PROXY,
);

export const GetListQueryKey = "/4/list/[list_id]";
export const getListQuery = getQuery<ListDetails, { list_id: number; page?: number }>(GetListQueryKey, ACCOUNT_PROXY);

/**
 * Whether one title is already on one list.
 *
 * TMDB has no "which of my lists hold this title" endpoint, so this is the only
 * honest answer to that question and it costs one request per list. The caller
 * is what keeps that bounded — see `AddToListMenu`.
 *
 * TMDB answers 404 when the title is not on the list, so absence arrives as an
 * axios error rather than as `success: false`.
 */
export const GetListItemStatusQueryKey = "/4/list/[list_id]/item_status";
export const getListItemStatusQuery = getQuery<
  StatusResponse & { media_type: MediaType; media_id: number },
  { list_id: number; media_id: number; media_type: MediaType }
>(GetListItemStatusQueryKey, ACCOUNT_PROXY);

/**
 * `iso_639_1` is not optional in practice — TMDB rejects a create without it —
 * and `public` is spelled by every caller here rather than defaulted, because
 * TMDB's own default publishes the list on the viewer's profile.
 */
export const CreateListKey = "/4/list";
export const createListMutation = postMutation<
  CreatedList,
  { name: string; iso_639_1: string; description?: string; public?: boolean }
>(CreateListKey, ACCOUNT_PROXY);

/** Rename and delete share the read's path, one resource under three verbs. */
export const updateListMutation = putMutation<
  StatusResponse,
  { list_id: number; name?: string; description?: string; public?: boolean }
>(GetListQueryKey, ACCOUNT_PROXY);

export const deleteListMutation = deleteMutation<StatusResponse, { list_id: number }>(GetListQueryKey, ACCOUNT_PROXY);

/**
 * Add and remove are the same path under different verbs, and both take the
 * same `{ items: [...] }` body — so unlike the watchlist flag, membership is two
 * mutations rather than one boolean.
 */
export const ListItemsKey = "/4/list/[list_id]/items";
export const addListItemsMutation = postMutation<
  ListItemsResponse,
  { list_id: number; items: { media_type: MediaType; media_id: number }[] }
>(ListItemsKey, ACCOUNT_PROXY);

export const removeListItemsMutation = deleteMutation<
  ListItemsResponse,
  { list_id: number; items: { media_type: MediaType; media_id: number }[] }
>(ListItemsKey, ACCOUNT_PROXY);

/** Every account query key, for clearing the lot when the viewer changes. */
export const ACCOUNT_QUERY_KEYS = [
  GetAccountStatesQueryKey,
  GetWatchlistMoviesQueryKey,
  GetWatchlistTvQueryKey,
  GetFavoriteMoviesQueryKey,
  GetFavoriteTvQueryKey,
  GetRatedMoviesQueryKey,
  GetRatedTvQueryKey,
  GetRecommendedMoviesQueryKey,
  GetRecommendedTvQueryKey,
  GetAccountListsQueryKey,
  GetListQueryKey,
  GetListItemStatusQueryKey,
];
