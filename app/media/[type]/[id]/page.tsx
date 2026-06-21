import { notFound } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { MediaDetail } from "@/components/media/MediaDetail";
import { makeQueryClient } from "@/lib/tmdb/query-client";
import { getDetails } from "@/lib/tmdb/server";
import { appendToResponse } from "@/lib/utils";
import {
  AppendToResponse,
  GetMovieDetailsQueryKey,
  GetTVDetailsQueryKey,
  MediaType,
  type MovieDetails,
  type TVDetails,
} from "@/lib/tmdb/queries";

// ISR: cache the full route at the edge and regenerate in the background.
export const revalidate = 86400;

export default async function MediaDetailPage({ params }: { params: { type: string; id: string } }) {
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id) || (params.type !== "movie" && params.type !== "tv")) {
    notFound();
  }

  const type = params.type as MediaType;
  const isMovie = type === MediaType.movie;
  // Must match the append string the client hook uses, or hydration misses.
  const append = appendToResponse(AppendToResponse.credits, AppendToResponse.images, AppendToResponse.videos);

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: isMovie
      ? [GetMovieDetailsQueryKey, { movie_id: id, append_to_response: append }]
      : [GetTVDetailsQueryKey, { tv_id: id, append_to_response: append }],
    queryFn: () => getDetails<MovieDetails | TVDetails>(type, id, append),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MediaDetail id={id} type={type} />
    </HydrationBoundary>
  );
}
