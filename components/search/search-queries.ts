import { getQuery } from "@/lib/tmdb/hooks";
import { getTMDBGenre } from "@/lib/tmdb/images";
import { MediaType, type Movie, type TVShow } from "@/lib/tmdb/queries";
import { getYear } from "@/lib/utils";

export interface PersonSearchInput {
  query: string;
  page?: number;
  language?: string;
  include_adult?: boolean;
}
export interface PersonKnownFor {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
}
export interface PersonResult {
  id: number;
  name: string;
  profile_path: string | null;
  popularity: number;
  known_for_department?: string;
  known_for?: PersonKnownFor[];
}
export interface PersonSearchResponse {
  page: number;
  total_results: number;
  total_pages: number;
  results: PersonResult[];
}

/**
 * People are the one search type lib/tmdb/queries.ts does not cover. Declared with the same
 * factory as every other endpoint so it goes through the token-hiding proxy and inherits its
 * abort signal and `search/*` cache policy; it belongs in queries.ts once that file is free.
 */
export const GetSearchPeopleQueryKey = "/search/person";
export const getSearchPeopleQuery = getQuery<PersonSearchResponse, PersonSearchInput>(GetSearchPeopleQueryKey);

export type SearchKind = "movie" | "tv" | "person";

export const KIND_LABEL: Record<SearchKind, string> = {
  movie: "Movie",
  tv: "TV Series",
  person: "Person",
};

/** One shape for all three result types, so a single card and a single rail render every one of them. */
export interface SearchResult {
  kind: SearchKind;
  id: number;
  title: string;
  imagePath: string | null;
  backdropPath: string | null;
  year: string;
  overview: string;
  rating: number;
  popularity: number;
  genres: string[];
  subtitle: string;
  watchHref: string | null;
  detailHref: string | null;
}

function toGenreNames(genreIds: number[] = []): string[] {
  return genreIds
    .map((id) => getTMDBGenre(id))
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
}

export function toMovieResult(movie: Movie): SearchResult {
  const year = getYear(movie.release_date);
  return {
    kind: "movie",
    id: movie.id,
    title: movie.title,
    imagePath: movie.poster_path || null,
    backdropPath: movie.backdrop_path || null,
    year,
    overview: movie.overview,
    rating: movie.vote_average ?? 0,
    popularity: movie.popularity ?? 0,
    genres: toGenreNames(movie.genre_ids),
    subtitle: [year, "Movie"].filter(Boolean).join(" · "),
    watchHref: `/watch/${MediaType.movie}/${movie.id}`,
    detailHref: `/media/${MediaType.movie}/${movie.id}`,
  };
}

export function toShowResult(show: TVShow): SearchResult {
  const year = getYear(show.first_air_date);
  return {
    kind: "tv",
    id: show.id,
    title: show.name,
    imagePath: show.poster_path || null,
    backdropPath: show.backdrop_path || null,
    year,
    overview: show.overview,
    rating: show.vote_average ?? 0,
    popularity: show.popularity ?? 0,
    genres: toGenreNames(show.genre_ids),
    subtitle: [year, "TV"].filter(Boolean).join(" · "),
    watchHref: `/watch/${MediaType.tv}/${show.id}`,
    detailHref: `/media/${MediaType.tv}/${show.id}`,
  };
}

export function toPersonResult(person: PersonResult): SearchResult {
  const knownFor = (person.known_for ?? [])
    .map((entry) => entry.title || entry.name)
    .filter((title): title is string => Boolean(title))
    .slice(0, 2);

  return {
    kind: "person",
    id: person.id,
    title: person.name,
    imagePath: person.profile_path,
    backdropPath: null,
    year: "",
    overview: knownFor.length ? `Known for ${knownFor.join(", ")}.` : "",
    rating: 0,
    popularity: person.popularity ?? 0,
    genres: [],
    subtitle: [person.known_for_department, ...knownFor].filter(Boolean).join(" · "),
    // The app has no person route, so these cards stay inert rather than linking nowhere.
    watchHref: null,
    detailHref: null,
  };
}
