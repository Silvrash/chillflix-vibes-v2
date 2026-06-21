import { notFound } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { WatchView } from "@/components/player/WatchView";
import { makeQueryClient } from "@/lib/tmdb/query-client";
import { getDetails } from "@/lib/tmdb/server";
import { GetMovieDetailsQueryKey, GetTVDetailsQueryKey, MediaType, type MovieDetails, type TVDetails } from "@/lib/tmdb/queries";

export const revalidate = 86400;

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: { type: string; id: string };
  searchParams: { season?: string; episode?: string };
}) {
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id) || (params.type !== "movie" && params.type !== "tv")) {
    notFound();
  }

  const type = params.type as MediaType;
  const isMovie = type === MediaType.movie;
  const initialSeason = parseInt(searchParams.season ?? "1", 10) || 1;
  const initialEpisode = parseInt(searchParams.episode ?? "1", 10) || 1;

  // Prefetch the title metadata so it's in the SSR HTML (the player itself
  // renders immediately from the id, independent of this query).
  const queryClient = makeQueryClient();
  await queryClient
    .prefetchQuery({
      queryKey: isMovie ? [GetMovieDetailsQueryKey, { movie_id: id }] : [GetTVDetailsQueryKey, { tv_id: id }],
      queryFn: () => getDetails<MovieDetails | TVDetails>(type, id),
    })
    .catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WatchView id={id} type={type} initialSeason={initialSeason} initialEpisode={initialEpisode} />
    </HydrationBoundary>
  );
}
