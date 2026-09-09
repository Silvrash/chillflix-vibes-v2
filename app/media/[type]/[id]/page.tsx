import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { MediaDetail } from "@/components/media/MediaDetail";
import { makeQueryClient } from "@/lib/tmdb/query-client";
import { getDetails } from "@/lib/tmdb/server";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { appendToResponse } from "@/lib/utils";
import { SITE_NAME, SITE_OG_IMAGE, SITE_URL, clampDescription, inlineJson, tmdbErrorStatus } from "@/lib/seo";
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

/**
 * What this route claims when TMDB does not hand it a title: a status, never metadata.
 *
 * Not an empty object, which is what this used to return — Next merges metadata one top-level key
 * at a time, so a page that names nothing keeps every word of the root layout's, canonical "/" and
 * front-door card included, and one TMDB 429 during a crawl was enough to make a sitemap-listed
 * title page answer 200 while telling the crawler it *was* the home page.
 *
 * But nor is it a replacement head, which is what replaced that. A page that answers `notFound()`
 * renders app/not-found.tsx and takes *its* metadata, so a "Title not found" head written here was
 * only ever assembled and discarded; and the other branch — a placeholder title served 200 and
 * indexable — was the same mistake from the other side, an invented answer where the route had
 * none. Both failures below are therefore answered in the status line, which is where a crawler
 * reads them.
 *
 * A 404 is an answer: the title is not here and will not be, and app/not-found.tsx already says so
 * with noindex, no canonical and no card. Anything else is not an answer, so it is rethrown and the
 * request ends in a 5xx — read as "ask again later", indexing nothing and dropping nothing. The
 * part that matters under `revalidate` above is what then cannot happen: a render that throws is
 * never written to the route cache, and a failed background revalidation leaves the last good page
 * in it, so no single rate-limited crawl can pin a real title under a placeholder for a day. (503
 * is the exact word for it; an App Router page chooses 404 or throws, and 5xx is already the family
 * crawlers treat as temporary.)
 */
export async function generateMetadata({ params }: { params: { type: string; id: string } }): Promise<Metadata> {
  const parsed = parseParams(params);
  // A URL this route cannot even parse names no title either; the component below answers 404 for it.
  if (!parsed) notFound();
  const { id, type } = parsed;

  try {
    const data = await getDetails<MovieDetails | TVDetails>(type, id, DETAIL_APPEND);
    const name = "title" in data ? data.title : data.name;
    const year = ("release_date" in data ? data.release_date : data.first_air_date)?.slice(0, 4);
    const description = clampDescription(data.overview || `Watch ${name} on ${SITE_NAME}.`);
    // A title with neither backdrop nor poster — TMDB holds plenty — used to emit no image at all,
    // and a card with no artwork unfurls as a bare line of text next to every card that has some.
    // The site's own card is the floor: generic, but it says which site the link goes to.
    const artwork = getTMDBImageUrl(data.backdrop_path || data.poster_path, "w1280");
    const image = artwork
      ? { url: artwork, width: 1280, height: 720, alt: name }
      : { url: SITE_OG_IMAGE, width: 1200, height: 630, alt: name };
    // One string for both, so the address the page claims and the one its card points at agree.
    const canonical = `/media/${type}/${id}`;

    return {
      title: year ? `${name} (${year})` : name,
      description,
      alternates: { canonical },
      openGraph: {
        type: type === MediaType.movie ? "video.movie" : "video.tv_show",
        // The title here is the work's own, so the site is named beside it rather than appended to
        // it — the browse cards, whose titles are common nouns, spell it into the title instead.
        siteName: SITE_NAME,
        title: name,
        description,
        url: canonical,
        images: [image],
      },
      twitter: {
        card: "summary_large_image",
        title: name,
        description,
        images: [image.url],
      },
    };
  } catch (error) {
    if (tmdbErrorStatus(error) === 404) notFound();
    throw error;
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

  // `prefetchQuery` swallows the rejection, so the reason is read back off the query state — and the
  // body answers exactly as the head above did. It has to: Next dedupes the two identical fetches
  // within a request, so they always see the same outcome, and a body that stood while the head had
  // already thrown would be a 200 nobody could ever be served.
  if (!details) {
    const error = queryClient.getQueryState(queryKey)?.error;
    if (tmdbErrorStatus(error) === 404) notFound();
    throw error ?? new Error(`TMDB returned no data for ${type}/${id}`);
  }

  return (
    <>
      {/* Escaped for the script element it sits in, not just as JSON — the title and the overview
          below are community-edited TMDB text, and `JSON.stringify` alone would let one close this tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: inlineJson(buildJsonLd(details, type, id)) }} />
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
