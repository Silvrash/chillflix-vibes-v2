import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { appendToResponse } from "@/lib/utils";
import {
  AppendToResponse,
  MediaType,
  getMovieDetailsQuery,
  getMovieRecommendationsInfiniteQuery,
  getMovieSimilarInfiniteQuery,
  getTVDetailsQuery,
  getTVRecommendationsInfiniteQuery,
  getTVSimilarInfiniteQuery,
} from "./queries";

function useMovieMediaQueries(id: number, type: MediaType) {
  const query = useQuery(
    getMovieDetailsQuery({
      enabled: type === MediaType.movie,
      variables: {
        movie_id: id,
        append_to_response: appendToResponse(AppendToResponse.credits, AppendToResponse.images, AppendToResponse.videos),
      },
    }),
  );

  const similarQuery = useInfiniteQuery(
    getMovieSimilarInfiniteQuery({
      enabled: !!query.data && type === MediaType.movie,
      variables: { movie_id: id },
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.page + 1,
      getPreviousPageParam: (firstPage) => (firstPage.page <= 1 ? undefined : firstPage.page - 1),
    }),
  );

  const recommendedQuery = useInfiniteQuery(
    getMovieRecommendationsInfiniteQuery({
      variables: { movie_id: id },
      enabled: !!query.data && type === MediaType.movie,
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.page + 1,
      getPreviousPageParam: (firstPage) => (firstPage.page <= 1 ? undefined : firstPage.page - 1),
    }),
  );

  return { query, similarQuery, recommendedQuery };
}

function useTvShowMediaQueries(id: number, type: MediaType) {
  const query = useQuery(
    getTVDetailsQuery({
      enabled: type === MediaType.tv,
      variables: {
        tv_id: id,
        append_to_response: appendToResponse(AppendToResponse.credits, AppendToResponse.images, AppendToResponse.videos),
      },
    }),
  );

  const similarQuery = useInfiniteQuery(
    getTVSimilarInfiniteQuery({
      enabled: !!query.data && type === MediaType.tv,
      variables: { series_id: id },
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.page + 1,
      getPreviousPageParam: (firstPage) => (firstPage.page <= 1 ? undefined : firstPage.page - 1),
    }),
  );

  const recommendedQuery = useInfiniteQuery(
    getTVRecommendationsInfiniteQuery({
      variables: { series_id: id },
      enabled: !!query.data && type === MediaType.tv,
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.page + 1,
      getPreviousPageParam: (firstPage) => (firstPage.page <= 1 ? undefined : firstPage.page - 1),
    }),
  );

  return { query, similarQuery, recommendedQuery };
}

export function useMediaTypeQueries(id: number, mediaType: MediaType) {
  const movieQuery = useMovieMediaQueries(id, mediaType);
  const tvShowQuery = useTvShowMediaQueries(id, mediaType);
  return mediaType === MediaType.movie ? movieQuery : tvShowQuery;
}
