import { MOVIE_SERVERS, STREAM_SERVERS, getAnimeServers } from "@/lib/streaming/vidsrc";
import { MediaType } from "@/lib/tmdb/queries";

/**
 * Chrome-less player page, built for the TV app.
 *
 * The native app can't reproduce the conditions the embed providers expect —
 * a synthetic WebView page is a different origin, referrer and header set from
 * the real site, and the providers are sensitive to all three. So the TV app
 * points a WebView at *this* route instead: the iframe is then served from the
 * real origin exactly as it is on the web, and anything we fix here (player
 * lineup, referrer policy, iframe permissions) reaches the TV on next launch
 * without shipping a new APK.
 *
 * Nothing else renders — no navbar, no padding, no scrollbars. The page is the
 * player.
 */
export const dynamic = "force-dynamic";

/** Player ids, in lineup order. Mirrors `data/Streams.kt` in the TV app. */
const PLAYER_IDS = ["main", "alternate", "backup"];

interface EmbedPageProps {
  params: { type: string; id: string };
  searchParams: {
    season?: string;
    episode?: string;
    /** Stable player id — "main", "alternate" or "backup". Preferred. */
    player?: string;
    /** Legacy: index into the player lineup. Kept so older builds keep working. */
    server?: string;
    /** AniList id, when the caller already knows the title is anime. */
    anilist?: string;
  };
}

export default function EmbedPage({ params, searchParams }: EmbedPageProps) {
  const type = params.type === MediaType.tv ? MediaType.tv : MediaType.movie;
  const id = parseInt(params.id, 10);
  const season = parseInt(searchParams.season ?? "1", 10) || 1;
  const episode = parseInt(searchParams.episode ?? "1", 10) || 1;
  const anilistId = searchParams.anilist ? parseInt(searchParams.anilist, 10) : null;

  // Same lineups as the watch page: anime leads with vidnest, movies use the
  // two most reliable players, other TV gets the full list.
  const servers = anilistId ? getAnimeServers(anilistId) : type === MediaType.tv ? STREAM_SERVERS : MOVIE_SERVERS;

  // Lineups are ordered main → alternate → backup, so an id maps to a
  // position. Selecting by id rather than by index means the two sides can't
  // drift apart when the lineup is reordered: `main` is the main player here
  // and in the app, whatever position it happens to occupy.
  const byId = searchParams.player ? PLAYER_IDS.indexOf(searchParams.player) : -1;
  const requested = byId >= 0 ? byId : parseInt(searchParams.server ?? "0", 10) || 0;
  const server = servers[Math.min(Math.max(requested, 0), servers.length - 1)];

  const src =
    type === MediaType.tv
      ? server.getEpisodeLink(id, season, episode, { autoplay: true })
      : server.getMovieLink(id, { autoplay: true });

  return (
    <iframe
      key={src}
      src={src}
      title="Player"
      className="fixed inset-0 h-full w-full border-0 bg-black"
      allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *; accelerometer *; gyroscope *"
      referrerPolicy="origin"
    />
  );
}
