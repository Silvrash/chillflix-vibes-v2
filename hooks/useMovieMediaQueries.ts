import {
  AppendToResponse,
  getMovieDetailsQuery,
  getMovieRecommendationsInfiniteQuery,
  getMovieSimilarInfiniteQuery,
  MediaType,
} from "@/api/tmdb";
import { appendToResponse } from "@/constants/utilities";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export function useMovieMediaQueries(id: number, type: MediaType) {
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
      enabled: query.data && type === MediaType.movie,
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

  return { query, similarQuery, recommendedQuery, seasonDetails: null };
}
