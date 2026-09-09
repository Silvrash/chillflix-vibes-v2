import type { Metadata } from "next";
import { MOVIE_SERVERS, STREAM_SERVERS, getAnimeServers, type StreamServer } from "@/lib/streaming/vidsrc";
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

/**
 * A frame, not a page: no heading, no navigation, no words of its own, and nothing here that is not
 * better reached through the watch page that embeds it.
 *
 * Every key is spelled out because a page that names none of them inherits the root layout's whole
 * set — which is what happened: /embed/* was index,follow, carried the site's front-door card, and
 * gave `canonical: "/"`, so each of these frames told crawlers it was the home page. robots.txt
 * does not disallow /embed either, so nothing else was stopping that.
 *
 * `canonical: null` emits no canonical rather than a self-canonical, and that is the right shape
 * here twice over. A canonical is a claim about which address a page should be indexed under, and
 * this page asks not to be indexed under any; pairing noindex with a canonical is a page arguing
 * with itself, and Google's advice is not to. It would also be a claim this route cannot make
 * truthfully — the frame varies by `season`, `episode`, `player` and `anilist`, so a self-canonical
 * would have to either carry the query string, filing every episode of a show as its own document,
 * or drop it and fold them all onto one. There is nothing to canonicalise because there is no
 * document here: this route exists to be framed by the native apps, and the watch page — which
 * builds its own provider URL rather than loading this — holds the address worth naming.
 */
export const metadata: Metadata = {
  title: "Player",
  description: null,
  robots: { index: false, follow: false },
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
};

/**
 * The slot names `?player=` used to take, in lineup order.
 *
 * They named a POSITION rather than a provider, which is why they were
 * replaced. They still have to work: the TV app is sideloaded, so the builds
 * already on people's televisions cannot be updated remotely, and they ask for
 * `?player=main|alternate|backup`. Whatever the lineup is, these three go on
 * meaning its first, second and third entries — which is what those builds
 * meant by them.
 */
const LEGACY_SLOT_IDS = ["main", "alternate", "backup"];

interface EmbedPageProps {
  params: { type: string; id: string };
  searchParams: {
    season?: string;
    episode?: string;
    /** Provider id — "vidlink", "vidsrc-embed", "vidsrc-to", "vidnest". Preferred. */
    player?: string;
    /** Legacy: index into the player lineup. Kept so older builds keep working. */
    server?: string;
    /** AniList id, when the caller already knows the title is anime. */
    anilist?: string;
  };
}

/**
 * Hands keyboard focus to the player frame, and keeps trying.
 *
 * A remote emits key events, and the player only answers them when something
 * inside the page holds focus. In a browser a click arranges that; in a TV app
 * there is no pointer and nothing clicks, so the D-pad appears dead — the
 * player's own play/pause and seek controls can never be reached.
 *
 * The frame is swapped in after the provider's scripts run, so one call on load
 * lands too early; this retries briefly and again whenever the page is shown.
 */
const FOCUS_PLAYER_FRAME = `
  (function () {
    function focusFrame() {
      var frame = document.querySelector('iframe');
      if (frame) { try { frame.focus(); } catch (e) {} }
    }
    var attempts = 0;
    var timer = setInterval(function () {
      focusFrame();
      if (++attempts > 12) clearInterval(timer);
    }, 400);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) focusFrame();
    });
    window.addEventListener('focus', focusFrame);
  })();
`;

/**
 * Same floors as `parseAsPosition` in components/player/WatchView.tsx, which is
 * where the web player reads a position from the URL: season floors at 0,
 * episode at 1. It deliberately answers `null` where this answers 1 — that one
 * is asked both "what plays?" and "did the URL name anything?", and has
 * localStorage to fall back on; this frame is handed a position or plays the
 * start of the show, and has nowhere else to look.
 *
 * Season 0 is the specials season and a real destination, so a parsed 0 has to
 * survive rather than fall to the 1 a truthiness check would give it.
 *
 * No shipped client sends one today — both native apps pick seasons from
 * `MediaDetails.airedSeasons`, which filters to `seasonNumber > 0` in the TV
 * app's `data/Models.kt` and in the Mac app's `Data/Models.swift` alike, so
 * specials never reach this URL from them. But this is a plain URL that
 * anything can build, the detail page's episode cards link straight into season
 * 0 for a show whose only run is specials, and a route that answers a season it was
 * explicitly asked for by playing a different one is worse than one that plays
 * nothing.
 */
function parsePosition(value: string | undefined, min: number) {
  const parsed = parseInt(value ?? "", 10);
  return Number.isNaN(parsed) || parsed < min ? 1 : parsed;
}

/**
 * A position in this lineup, whatever it was asked for with: past the end is
 * clamped, and anything that is not a position at all is the first player.
 *
 * Never nothing. This route is the only thing between a television and a film,
 * so a request it cannot make sense of plays the main player rather than an
 * empty frame or a 404.
 */
function clampToLineup(position: number, servers: StreamServer[]) {
  if (Number.isNaN(position) || position < 0) return 0;
  return Math.min(position, servers.length - 1);
}

/**
 * Which player was asked for, out of the three ways of asking.
 *
 * A provider id is the one that means the same thing on every surface, so it is
 * tried first and against this lineup: `vidnest` on a film, or `vidsrc-to` on a
 * movie lineup that drops it, names no player here and falls to the first one —
 * the same rule `serverIndexById` and the TV app's own lookup apply, so a
 * preference resolves identically wherever it is read.
 *
 * The other two are positional and predate provider ids. Both are still in the
 * field on televisions that cannot be updated, so both still resolve by
 * position, and `?player=` is answered before `?server=` because the TV app
 * sends both and the id is the more specific of the two.
 */
function requestedIndex(servers: StreamServer[], player: string | undefined, server: string | undefined) {
  if (player !== undefined) {
    const provider = servers.findIndex((entry) => entry.id === player);
    return provider >= 0 ? provider : clampToLineup(LEGACY_SLOT_IDS.indexOf(player), servers);
  }
  return clampToLineup(parseInt(server ?? "", 10), servers);
}

export default function EmbedPage({ params, searchParams }: EmbedPageProps) {
  const type = params.type === MediaType.tv ? MediaType.tv : MediaType.movie;
  const id = parseInt(params.id, 10);
  const season = parsePosition(searchParams.season, 0);
  const episode = parsePosition(searchParams.episode, 1);
  const anilistId = searchParams.anilist ? parseInt(searchParams.anilist, 10) : null;

  // Same lineups as the watch page: anime leads with vidnest, movies use the
  // two most reliable players, other TV gets the full list.
  const servers = anilistId ? getAnimeServers(anilistId) : type === MediaType.tv ? STREAM_SERVERS : MOVIE_SERVERS;

  const server = servers[requestedIndex(servers, searchParams.player, searchParams.server)];

  const src =
    type === MediaType.tv
      ? server.getEpisodeLink(id, season, episode, { autoplay: true })
      : server.getMovieLink(id, { autoplay: true });

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: FOCUS_PLAYER_FRAME }} />
      <iframe
        key={src}
        src={src}
        title="Player"
        className="fixed inset-0 h-full w-full border-0 bg-black"
        allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *; accelerometer *; gyroscope *"
        referrerPolicy="origin"
      />
    </>
  );
}
