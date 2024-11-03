import {
  AppendToResponse,
  getTVDetailsQuery,
  getTVRecommendationsInfiniteQuery,
  getTVSimilarInfiniteQuery,
  MediaType,
} from "@/api/tmdb";
import { appendToResponse } from "@/constants/utilities";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";

export function useTvShowMediaQueries(id: number, type: MediaType) {
  const queryClient = useQueryClient();
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
      enabled: query.data && type === MediaType.tv,
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
