import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { MediaDetail } from "@/components/media/MediaDetail";
import { makeQueryClient } from "@/lib/tmdb/query-client";
import { getDetails } from "@/lib/tmdb/server";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { appendToResponse } from "@/lib/utils";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
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

// Must match the append the client hook uses, or hydration misses. Credits are
// excluded here — they're fetched lazily when expanded.
const DETAIL_APPEND = appendToResponse(AppendToResponse.images, AppendToResponse.videos);

function parseParams(params: { type: string; id: string }) {
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id) || (params.type !== "movie" && params.type !== "tv")) return null;
  return { id, type: params.type as MediaType };
}

export async function generateMetadata({ params }: { params: { type: string; id: string } }): Promise<Metadata> {
  const parsed = parseParams(params);
  if (!parsed) return {};
  const { id, type } = parsed;

  try {
    const data = await getDetails<MovieDetails | TVDetails>(type, id, DETAIL_APPEND);
    const name = "title" in data ? data.title : data.name;
    const year = ("release_date" in data ? data.release_date : data.first_air_date)?.slice(0, 4);
    const description = (data.overview || `Watch ${name} on ${SITE_NAME}.`).slice(0, 200);
    const image = getTMDBImageUrl(data.backdrop_path || data.poster_path, "w1280");
    const canonical = `/media/${type}/${id}`;

    return {
      title: year ? `${name} (${year})` : name,
      description,
      alternates: { canonical },
      openGraph: {
        type: type === MediaType.movie ? "video.movie" : "video.tv_show",
        title: name,
        description,
        url: canonical,
        images: image ? [{ url: image, width: 1280, height: 720, alt: name }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: name,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return {};
  }
}

export default async function MediaDetailPage({ params }: { params: { type: string; id: string } }) {
  const parsed = parseParams(params);
  if (!parsed) notFound();
  const { id, type } = parsed;
  const isMovie = type === MediaType.movie;

  const queryClient = makeQueryClient();
  const queryKey = isMovie
    ? [GetMovieDetailsQueryKey, { movie_id: id, append_to_response: DETAIL_APPEND }]
    : [GetTVDetailsQueryKey, { tv_id: id, append_to_response: DETAIL_APPEND }];

  await queryClient.prefetchQuery({
    queryKey,
    queryFn: () => getDetails<MovieDetails | TVDetails>(type, id, DETAIL_APPEND),
  });
  const details = queryClient.getQueryData<MovieDetails | TVDetails>(queryKey);

  return (
    <>
      {details && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(details, type, id)) }} />
      )}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MediaDetail id={id} type={type} />
      </HydrationBoundary>
    </>
  );
}

/** Schema.org Movie / TVSeries structured data for rich search results. */
function buildJsonLd(data: MovieDetails | TVDetails, type: MediaType, id: number) {
  const name = "title" in data ? data.title : data.name;
  const date = "release_date" in data ? data.release_date : data.first_air_date;
  const poster = getTMDBImageUrl(data.poster_path, "w500");

  return {
    "@context": "https://schema.org",
    "@type": type === MediaType.movie ? "Movie" : "TVSeries",
    name,
    url: `${SITE_URL}/media/${type}/${id}`,
    ...(data.overview ? { description: data.overview } : {}),
    ...(poster ? { image: poster } : {}),
    ...(date ? { datePublished: date } : {}),
    ...("genres" in data && data.genres?.length ? { genre: data.genres.map((g) => g.name) } : {}),
    ...(data.vote_average > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: data.vote_average.toFixed(1),
            bestRating: 10,
            worstRating: 1,
            ratingCount: data.vote_count,
          },
        }
      : {}),
  };
}
