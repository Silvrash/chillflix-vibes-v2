import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { WatchView } from "@/components/player/WatchView";
import { makeQueryClient } from "@/lib/tmdb/query-client";
import { getDetails } from "@/lib/tmdb/server";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { SITE_NAME, SITE_OG_IMAGE, clampDescription, tmdbErrorStatus } from "@/lib/seo";
import { GetMovieDetailsQueryKey, GetTVDetailsQueryKey, MediaType, type MovieDetails, type TVDetails } from "@/lib/tmdb/queries";

/**
 * Nothing here reads the query string — the season and episode being watched
 * live in the URL, and the player reads them itself on the client — so one
 * stored HTML really would serve every `?season=&episode=` for a title. What it
 * would not contain is the title: a client hook reading the query string bails
 * its whole subtree out of static rendering rather than correcting it, so a
 * statically generated page ships the shell and none of the markup the
 * prefetch below exists to produce. Rendering per request keeps it, and the
 * cached data layer keeps it cheap — every fetch carries its own revalidate
 * window.
 */
export const dynamic = "force-dynamic";

function parseParams(params: { type: string; id: string }) {
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id) || (params.type !== "movie" && params.type !== "tv")) return null;
  return { id, type: params.type as MediaType };
}

/**
 * The head this page wears, in one piece — and a status rather than a head when there is no title
 * to build one from.
 *
 * Every key is spelled out because Next merges metadata one top-level key at a time: `openGraph`
 * alone left the layout's `twitter` block untouched underneath it, so a page whose og:title read
 * "Watch Fight Club" told X it was "ChillFlixVibes — Stream Movies, TV & Anime", with the site's
 * front-door artwork. Setting one of the two means setting both.
 *
 * Returning `{}` on a TMDB failure was the same rule biting harder: nothing named means nothing
 * replaced, so the page kept the layout's canonical "/", its whole card and its index,follow — a
 * player URL for a title nobody has, answering 200 and claiming to be the front door. There is no
 * head worth inventing in its place. A 404 is a real answer and app/not-found.tsx writes the head
 * for it; every other failure is rethrown, so the request ends in a 5xx a crawler reads as "ask
 * again later" rather than as a page. Both are decided on the same rule as /media, from the same
 * helper, because a player URL and a detail URL for one missing title must not answer differently.
 */
export async function generateMetadata({ params }: { params: { type: string; id: string } }): Promise<Metadata> {
  const parsed = parseParams(params);
  // A URL this route cannot even parse names no title either; the component below answers 404 for it.
  if (!parsed) notFound();
  const { id, type } = parsed;

  try {
    const data = await getDetails<MovieDetails | TVDetails>(type, id);
    const name = "title" in data ? data.title : data.name;
    // Cut at a word boundary rather than at character 160: a plot summary is not written to a length,
    // and a hard slice ends the card mid-word — this one used to stop at "catches on, with un".
    const description = clampDescription(data.overview || `Watch ${name} on ${SITE_NAME}.`);
    // A title TMDB holds no artwork for would otherwise unfurl as a bare line of text beside every
    // card that has some; the site's own image is generic but says where the link goes.
    const artwork = getTMDBImageUrl(data.backdrop_path || data.poster_path, "w1280");
    const image = artwork
      ? { url: artwork, width: 1280, height: 720, alt: name }
      : { url: SITE_OG_IMAGE, width: 1200, height: 630, alt: name };
    // One string for both, so the address the page claims and the one its card points at agree.
    const canonical = `/watch/${type}/${id}`;
    const title = `Watch ${name}`;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        type: "video.other",
        // Named beside the work's own title rather than appended to it: only the tab gets the suffix
        // from the layout's title template, and a card that reads "Watch Fight Club" wants the site
        // in its own field, not in its headline.
        siteName: SITE_NAME,
        title,
        description,
        url: canonical,
        images: [image],
      },
      twitter: { card: "summary_large_image", title, description, images: [image.url] },
    };
  } catch (error) {
    if (tmdbErrorStatus(error) === 404) notFound();
    throw error;
  }
}

export default async function WatchPage({ params }: { params: { type: string; id: string } }) {
  const parsed = parseParams(params);
  if (!parsed) notFound();
  const { id, type } = parsed;
  const isMovie = type === MediaType.movie;

  // Prefetch the title metadata so it's in the SSR HTML (the player itself
  // renders immediately from the id, independent of this query).
  const queryClient = makeQueryClient();
  const queryKey = isMovie ? [GetMovieDetailsQueryKey, { movie_id: id }] : [GetTVDetailsQueryKey, { tv_id: id }];
  await queryClient.prefetchQuery({
    queryKey,
    queryFn: () => getDetails<MovieDetails | TVDetails>(type, id),
  });

  // `prefetchQuery` swallows the rejection, so the reason is read back off the query state, and the
  // body answers as the head did. The failure used to be swallowed here on the grounds that the
  // player needs only the id — but Next dedupes the two identical fetches within a request, so
  // whatever failed here failed in `generateMetadata` first and the response was never going to be
  // this page. Answering twice, differently, only hid which answer was real.
  if (!queryClient.getQueryData(queryKey)) {
    const error = queryClient.getQueryState(queryKey)?.error;
    if (tmdbErrorStatus(error) === 404) notFound();
    throw error ?? new Error(`TMDB returned no data for ${type}/${id}`);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* No position is passed down. The player resolves it from the URL and
          from storage, both of which it reads live — handing it a second copy
          taken at render time is what let the address bar and the episode on
          screen disagree after a back-navigation, which replays the payload an
          entry was pushed with while restoring the URL it was left at. */}
      <WatchView id={id} type={type} />
    </HydrationBoundary>
  );
}
