import { getInfiniteQuery, getLazyQuery, getQuery } from "./hooks";

export interface AuthenticationResult {
  success: boolean;
  status_code: number;
  status_message: string;
}
export const GetAuthenticateQueryKey = "/authentication";
export const getAuthenticateQuery = getQuery<AuthenticationResult, unknown>(GetAuthenticateQueryKey);
export const getAuthenticateLazyQuery = getLazyQuery<AuthenticationResult, unknown>(GetAuthenticateQueryKey);
export const getAuthenticateInfiniteQuery = getInfiniteQuery<AuthenticationResult, unknown>(GetAuthenticateQueryKey);

export enum TimeWindow {
  day = "day",
  week = "week",
}
export enum MediaType {
  tv = "tv",
  movie = "movie",
}
export interface TrendingInput {
  time_window: TimeWindow;
  language?: string;
}
export interface TrendingItem {
  adult: boolean;
  backdrop_path: string;
  id: number;
  title: string;
  name: string;
  original_language: string;
  original_title: string;
  original_name: string;
  overview: string;
  poster_path: string;
  media_type: MediaType;
  genre_ids: number[];
  popularity: number;
  release_date?: string;
  first_air_date?: string;
  origin_country?: string[];
  video: boolean;
  vote_average: number;
  vote_count: number;
}
export interface TrendingResponse {
  page: number;
  results: TrendingItem[];
  total_pages: number;
  total_results: number;
}
export const GetTrendingAllQueryKey = "/trending/all/[time_window]";
export const getTrendingAllQuery = getQuery<TrendingResponse, TrendingInput>(GetTrendingAllQueryKey);
export const getTrendingAllLazyQuery = getLazyQuery<TrendingResponse, TrendingInput>(GetTrendingAllQueryKey);
export const getTrendingAllInfiniteQuery = getInfiniteQuery<TrendingResponse, TrendingInput>(GetTrendingAllQueryKey);

export const GetTrendingMoviesQueryKey = "/trending/movie/[time_window]";
export const getTrendingMoviesQuery = getQuery<TrendingResponse, TrendingInput>(GetTrendingMoviesQueryKey);
export const getTrendingMoviesLazyQuery = getLazyQuery<TrendingResponse, TrendingInput>(GetTrendingMoviesQueryKey);
export const getTrendingMoviesInfiniteQuery = getInfiniteQuery<TrendingResponse, TrendingInput>(GetTrendingMoviesQueryKey);

export const GetTrendingTVShowsQueryKey = "/trending/tv/[time_window]";
export const getTrendingTVShowsQuery = getQuery<TrendingResponse, TrendingInput>(GetTrendingTVShowsQueryKey);
export const getTrendingTVShowsLazyQuery = getLazyQuery<TrendingResponse, TrendingInput>(GetTrendingTVShowsQueryKey);
export const getTrendingTVShowsInfiniteQuery = getInfiniteQuery<TrendingResponse, TrendingInput>(GetTrendingTVShowsQueryKey);

export interface Configuration {
  images: ConfigurationImages;
  change_keys: string[];
}
export interface ConfigurationImages {
  base_url: string;
  secure_base_url: string;
  backdrop_sizes: string[];
  logo_sizes: string[];
  poster_sizes: string[];
  profile_sizes: string[];
  still_sizes: string[];
}
export const GetConfigurationQueryKey = "/configuration";
export const getConfigurationQuery = getQuery<Configuration, unknown>(GetConfigurationQueryKey);
export const getConfigurationLazyQuery = getLazyQuery<Configuration, unknown>(GetConfigurationQueryKey);
export const getConfigurationInfiniteQuery = getInfiniteQuery<Configuration, unknown>(GetConfigurationQueryKey);

export enum SortBy {
  popularity_desc = "popularity.desc",
  popularity_asc = "popularity.asc",
  vote_average_desc = "vote_average.desc",
  vote_average_asc = "vote_average.asc",
  vote_count_desc = "vote_count.desc",
  revenue_desc = "revenue.desc",
  primary_release_date_desc = "primary_release_date.desc",
  primary_release_date_asc = "primary_release_date.asc",
  first_air_date_desc = "first_air_date.desc",
  first_air_date_asc = "first_air_date.asc",
  original_title_asc = "original_title.asc",
}
export interface DiscoverMovieInput {
  page?: number;
  sort_by?: string;
  year?: number;
  primary_release_year?: number;
  language?: string;
  region?: string;
  certification_country?: string;
  certification?: string;
  include_adult?: boolean;
  include_video?: boolean;
  with_people?: string;
  with_genres?: string;
  without_genres?: string;
  with_keywords?: string;
  without_keywords?: string;
  with_runtime_gte?: number;
  with_runtime_lte?: number;
  with_release_type?: number;
  with_original_language?: string;
  "primary_release_date.lte"?: string;
}
export interface Movie {
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  poster_path: string;
  release_date: string;
  title: string;
  popularity: number;
  video: boolean;
  vote_average: number;
  vote_count: number;
  quality?: string;
}
export interface DiscoverMovieResponse {
  page: number;
  total_results: number;
  total_pages: number;
  results: Movie[];
}
export const GetDiscoverMoviesQueryKey = "/discover/movie";
export const getDiscoverMoviesQuery = getQuery<DiscoverMovieResponse, DiscoverMovieInput>(GetDiscoverMoviesQueryKey);
export const getDiscoverMoviesLazyQuery = getLazyQuery<DiscoverMovieResponse, DiscoverMovieInput>(GetDiscoverMoviesQueryKey);
export const getDiscoverMoviesInfiniteQuery = getInfiniteQuery<DiscoverMovieResponse, DiscoverMovieInput>(
  GetDiscoverMoviesQueryKey,
);

export interface MovieRecommendationInput {
  movie_id: number;
  page?: number;
}
export interface MovieRecommendationsResponse {
  page: number;
  total_results: number;
  total_pages: number;
  results: Movie[];
}
export const GetMovieRecommendationsQueryKey = "/movie/[movie_id]/recommendations";
export const getMovieRecommendationsQuery = getQuery<MovieRecommendationsResponse, MovieRecommendationInput>(
  GetMovieRecommendationsQueryKey,
);
export const getMovieRecommendationsLazyQuery = getLazyQuery<MovieRecommendationsResponse, MovieRecommendationInput>(
  GetMovieRecommendationsQueryKey,
);
export const getMovieRecommendationsInfiniteQuery = getInfiniteQuery<MovieRecommendationsResponse, MovieRecommendationInput>(
  GetMovieRecommendationsQueryKey,
);

export interface MovieSimilarInput {
  movie_id: number;
  page?: number;
}
export interface MovieSimilarResponse {
  page: number;
  total_results: number;
  total_pages: number;
  results: Movie[];
}
export const GetMovieSimilarQueryKey = "/movie/[movie_id]/similar";
export const getMovieSimilarQuery = getQuery<MovieSimilarResponse, MovieSimilarInput>(GetMovieSimilarQueryKey);
export const getMovieSimilarLazyQuery = getLazyQuery<MovieSimilarResponse, MovieSimilarInput>(GetMovieSimilarQueryKey);
export const getMovieSimilarInfiniteQuery = getInfiniteQuery<MovieSimilarResponse, MovieSimilarInput>(GetMovieSimilarQueryKey);

export interface DiscoverTVInput {
  page?: number;
  sort_by?: string;
  first_air_date_year?: number;
  language?: string;
  timezone?: string;
  vote_average_gte?: number;
  vote_count_gte?: number;
  with_genres?: string;
  with_networks?: string;
  without_genres?: string;
  with_keywords?: string;
  without_keywords?: string;
  with_original_language?: string;
  include_null_first_air_dates?: boolean;
  include_adult?: boolean;
  "first_air_date.lte"?: string;
}
export interface TVShow {
  backdrop_path: string;
  first_air_date: string;
  genre_ids: number[];
  id: number;
  name: string;
  origin_country: string[];
  original_language: string;
  original_name: string;
  overview: string;
  popularity: number;
  poster_path: string;
  vote_average: number;
  vote_count: number;
}
export interface DiscoverTVResponse {
  page: number;
  total_results: number;
  total_pages: number;
  results: TVShow[];
}
export const GetDiscoverTVShowsQueryKey = "/discover/tv";
export const getDiscoverTVShowsQuery = getQuery<DiscoverTVResponse, DiscoverTVInput>(GetDiscoverTVShowsQueryKey);
export const getDiscoverTVShowsLazyQuery = getLazyQuery<DiscoverTVResponse, DiscoverTVInput>(GetDiscoverTVShowsQueryKey);
export const getDiscoverTVShowsInfiniteQuery = getInfiniteQuery<DiscoverTVResponse, DiscoverTVInput>(GetDiscoverTVShowsQueryKey);

export interface TVRecommendationInput {
  series_id: number;
  page?: number;
}
export interface TVRecommendationsResponse {
  page: number;
  total_results: number;
  total_pages: number;
  results: TVShow[];
}
export const GetTVRecommendationsQueryKey = "/tv/[series_id]/recommendations";
export const getTVRecommendationsQuery = getQuery<TVRecommendationsResponse, TVRecommendationInput>(GetTVRecommendationsQueryKey);
export const getTVRecommendationsLazyQuery = getLazyQuery<TVRecommendationsResponse, TVRecommendationInput>(
  GetTVRecommendationsQueryKey,
);
export const getTVRecommendationsInfiniteQuery = getInfiniteQuery<TVRecommendationsResponse, TVRecommendationInput>(
  GetTVRecommendationsQueryKey,
);

export interface TVSimilarInput {
  series_id: number;
  page?: number;
}
export interface TVSimilarResponse {
  page: number;
  total_results: number;
  total_pages: number;
  results: TVShow[];
}
export const GetTVSimilarQueryKey = "/tv/[series_id]/similar";
export const getTVSimilarQuery = getQuery<TVSimilarResponse, TVSimilarInput>(GetTVSimilarQueryKey);
export const getTVSimilarLazyQuery = getLazyQuery<TVSimilarResponse, TVSimilarInput>(GetTVSimilarQueryKey);
export const getTVSimilarInfiniteQuery = getInfiniteQuery<TVSimilarResponse, TVSimilarInput>(GetTVSimilarQueryKey);

export interface MovieDetailsInput {
  append_to_response?: string;
  movie_id: number;
}
export interface Genre {
  id: number;
  name: string;
}
export interface ProductionCompany {
  id: number;
  logo_path: string;
  name: string;
  origin_country: string;
}
export interface ProductionCountry {
  iso_3166_1: string;
  name: string;
}
export interface SpokenLanguage {
  iso_639_1: string;
  name: string;
  english_name?: string;
}
export interface BelongsToCollection {
  id: number;
  name: string;
  poster_path?: string;
  backdrop_path?: string;
}
export interface MovieDetails {
  adult: boolean;
  backdrop_path: string;
  belongs_to_collection: BelongsToCollection;
  budget: number;
  genres: Genre[];
  homepage: string;
  id: number;
  imdb_id: string;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  production_companies: ProductionCompany[];
  production_countries: ProductionCountry[];
  release_date: string;
  revenue: number;
  runtime: number;
  spoken_languages: SpokenLanguage[];
  status: string;
  tagline: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
  similar?: DiscoverMovieResponse;
  videos?: VideoList;
  external_ids: ExternalIds;
  credits?: Credit;
}
export enum AppendToResponse {
  images = "images",
  videos = "videos",
  credits = "credits",
  external_ids = "external_ids",
  similar = "similar",
  recommendations = "recommendations",
}
export interface Image {
  aspect_ratio: number;
  file_path: string;
  height: number;
  width: number;
  vote_average: number;
  vote_count: number;
}
export interface Video {
  id: string;
  iso_639_1: string;
  iso_3166_1: string;
  key: string;
  name: string;
  site: string;
  size: number;
  type: string;
}
export interface VideoList {
  results: Video[];
}
export interface Credit {
  id: string;
  cast: Cast[];
  crew: Crew[];
}
export interface Cast {
  cast_id: number;
  character: string;
  credit_id: string;
  gender: number;
  id: number;
  name: string;
  order: number;
  profile_path: string;
}
export interface Crew {
  credit_id: string;
  department: string;
  gender: number;
  id: number;
  job: string;
  name: string;
  profile_path: string;
}
export interface ExternalIds {
  imdb_id: string;
  wikidata_id?: string;
  facebook_id?: string;
  instagram_id?: string;
  twitter_id?: string;
}
export const GetMovieDetailsQueryKey = "/movie/[movie_id]";
export const getMovieDetailsQuery = getQuery<MovieDetails, MovieDetailsInput>(GetMovieDetailsQueryKey);
export const getMovieDetailsLazyQuery = getLazyQuery<MovieDetails, MovieDetailsInput>(GetMovieDetailsQueryKey);
export const getMovieDetailsInfiniteQuery = getInfiniteQuery<MovieDetails, MovieDetailsInput>(GetMovieDetailsQueryKey);

export interface TVDetailsInput {
  append_to_response?: string;
  tv_id: number;
}
export interface TVDetails {
  backdrop_path: string;
  created_by: Creator[];
  episode_run_time: number[];
  first_air_date: string;
  genres: Genre[];
  homepage: string;
  id: number;
  in_production: boolean;
  languages: string[];
  last_air_date: string;
  last_episode_to_air: Episode;
  name: string;
  networks: Network[];
  next_episode_to_air: Episode;
  number_of_episodes: number;
  number_of_seasons: number;
  origin_country: string[];
  original_language: string;
  original_name: string;
  overview: string;
  popularity: number;
  poster_path: string;
  production_companies: ProductionCompany[];
  production_countries: ProductionCountry[];
  seasons: Season[];
  spoken_languages: SpokenLanguage[];
  status: string;
  tagline: string;
  type: string;
  vote_average: number;
  vote_count: number;
  similar?: DiscoverTVResponse;
  videos?: VideoList;
  external_ids: ExternalIds;
  credits?: Credit;
}
export interface Creator {
  id: number;
  credit_id: string;
  name: string;
  gender: number;
  profile_path: string;
}
export interface Episode {
  air_date: string;
  episode_number: number;
  id: number;
  name: string;
  overview: string;
  production_code: string;
  season_number: number;
  still_path: string;
  vote_average: number;
  vote_count: number;
}
export interface Network {
  id: number;
  logo_path: string;
  name: string;
  origin_country: string;
}
export interface Season {
  air_date: string;
  episode_count: number;
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  season_number: number;
}
export const GetTVDetailsQueryKey = "/tv/[tv_id]";
export const getTVDetailsQuery = getQuery<TVDetails, TVDetailsInput>(GetTVDetailsQueryKey);
export const getTVDetailsLazyQuery = getLazyQuery<TVDetails, TVDetailsInput>(GetTVDetailsQueryKey);
export const getTVDetailsInfiniteQuery = getInfiniteQuery<TVDetails, TVDetailsInput>(GetTVDetailsQueryKey);

// Standalone credits endpoints — fetched lazily (on expand) so cast/crew don't
// weigh down the initial detail-page payload.
export interface MovieCreditsInput {
  movie_id: number;
}
export const GetMovieCreditsQueryKey = "/movie/[movie_id]/credits";
export const getMovieCreditsQuery = getQuery<Credit, MovieCreditsInput>(GetMovieCreditsQueryKey);
export const getMovieCreditsLazyQuery = getLazyQuery<Credit, MovieCreditsInput>(GetMovieCreditsQueryKey);

export interface TVCreditsInput {
  series_id: number;
}
export const GetTVCreditsQueryKey = "/tv/[series_id]/credits";
export const getTVCreditsQuery = getQuery<Credit, TVCreditsInput>(GetTVCreditsQueryKey);
export const getTVCreditsLazyQuery = getLazyQuery<Credit, TVCreditsInput>(GetTVCreditsQueryKey);

export interface MovieSearchResponse {
  page: number;
  total_results: number;
  total_pages: number;
  results: Movie[];
}
export interface MovieSearchInput {
  query: string;
  page: number;
  language?: string;
  include_adult?: boolean;
  region?: string;
  year?: number;
  primary_release_year?: number;
}
export const GetSearchMoviesQueryKey = "/search/movie";
export const getSearchMoviesQuery = getQuery<MovieSearchResponse, MovieSearchInput>(GetSearchMoviesQueryKey);
export const getSearchMoviesLazyQuery = getLazyQuery<MovieSearchResponse, MovieSearchInput>(GetSearchMoviesQueryKey);
export const getSearchMoviesInfiniteQuery = getInfiniteQuery<MovieSearchResponse, MovieSearchInput>(GetSearchMoviesQueryKey);

export interface TVSearchResponse {
  page: number;
  total_results: number;
  total_pages: number;
  results: TVShow[];
}
export interface TVSearchInput {
  query: string;
  page?: number;
  language?: string;
  include_adult?: boolean;
  first_air_date_year?: number;
}
export const GetSearchTVSeriesQueryKey = "/search/tv";
export const getSearchTVSeriesQuery = getQuery<TVSearchResponse, TVSearchInput>(GetSearchTVSeriesQueryKey);
export const getSearchTVSeriesLazyQuery = getLazyQuery<TVSearchResponse, TVSearchInput>(GetSearchTVSeriesQueryKey);
export const getSearchTVSeriesInfiniteQuery = getInfiniteQuery<TVSearchResponse, TVSearchInput>(GetSearchTVSeriesQueryKey);

export interface StreamingLinks {
  season_number: number;
  episode_number: number;
  title: string;
  tmdb_id: number;
  quality: string;
  embed_url_tmdb: string;
  domain: string;
}
export interface SeasonDetails {
  _id: string;
  air_date: string;
  episodes: Episode[];
  name: string;
  overview: string;
  id: number;
  poster_path: string;
  season_number: number;
}
export interface SeasonDetailsInput {
  tv_id: number;
  season_number: number;
}
export const GetSeasonDetailsQueryKey = "/tv/[tv_id]/season/[season_number]";
export const getSeasonDetailsQuery = getQuery<SeasonDetails, SeasonDetailsInput>(GetSeasonDetailsQueryKey);
export const getSeasonDetailsLazyQuery = getLazyQuery<SeasonDetails, SeasonDetailsInput>(GetSeasonDetailsQueryKey);
export const getSeasonDetailsInfiniteQuery = getInfiniteQuery<SeasonDetails, SeasonDetailsInput>(GetSeasonDetailsQueryKey);
