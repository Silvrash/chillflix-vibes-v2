import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { WatchView } from "@/components/player/WatchView";
import { makeQueryClient } from "@/lib/tmdb/query-client";
import { getDetails } from "@/lib/tmdb/server";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { GetMovieDetailsQueryKey, GetTVDetailsQueryKey, MediaType, type MovieDetails, type TVDetails } from "@/lib/tmdb/queries";

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: { type: string; id: string } }): Promise<Metadata> {
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id) || (params.type !== "movie" && params.type !== "tv")) return {};
  const type = params.type as MediaType;

  try {
    const data = await getDetails<MovieDetails | TVDetails>(type, id);
    const name = "title" in data ? data.title : data.name;
    const description = (data.overview || `Watch ${name}.`).slice(0, 160);
    const image = getTMDBImageUrl(data.backdrop_path || data.poster_path, "w1280");
    return {
      title: `Watch ${name}`,
      description,
      alternates: { canonical: `/watch/${type}/${id}` },
      openGraph: {
        type: "video.other",
        title: `Watch ${name}`,
        description,
        url: `/watch/${type}/${id}`,
        images: image ? [{ url: image, width: 1280, height: 720, alt: name }] : undefined,
      },
    };
  } catch {
    return {};
  }
}

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
