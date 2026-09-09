/**
 * Embed-URL builders for the streaming providers. Playback is delivered as an
 * <iframe> pointing at these embed pages, so the web app simply needs the URL.
 *
 * vidlink.pro leads the film and TV lineups, on a report from the field that it
 * carries more titles than vidsrc-embed. Nothing here can check that, so treat
 * it as the reason for the order rather than as a property of the provider.
 *
 * What IS checkable: it serves Japanese (subbed) audio for anime from its /tv
 * endpoint, and it is the only provider that emits the PLAYER_EVENT messages
 * WatchView listens for, so auto-advance works on whichever lineups it leads.
 * That is the film and TV lineups only — anime leads with vidnest, which sends
 * no such message, so an anime episode does not advance on its own.
 *
 * The vidsrc domains are kept as fallback servers.
 */

const LANGUAGE = "en";

export interface StreamOptions {
  /**
   * Currently ignored by every provider: vidlink is the only one that ever read
   * it, and passing it made playback start MUTED, which is worse than not
   * autostarting at all. Callers still pass it, so the intent survives if the
   * provider ever separates the two.
   */
  autoplay?: boolean;
}

export interface StreamServer {
  /**
   * The provider, not the slot it occupies: `vidlink` names vidlink.pro
   * wherever it lands in a lineup. Stored preferences and `/embed`'s `?player=`
   * are keyed by this, which is what lets anime — leading with vidnest where
   * everything else leads with vidlink — be told apart from a general lineup
   * instead of both reading as "the first one".
   *
   * The same strings are spelled out in the TV app's `data/Streams.kt` and the
   * Mac app's `Data/Catalogue.swift`; they are a wire format between the three.
   */
  id: string;
  /** What the viewer sees: the slot, not the provider behind it. */
  name: string;
  getMovieLink: (tmdbId: number | string, opts?: StreamOptions) => string;
  getEpisodeLink: (tmdbId: number | string, season: number | string, episode: number | string, opts?: StreamOptions) => string;
}

/**
 * Where a provider sits in a lineup, and 0 when this lineup has no such
 * provider — a preference for vidnest carried onto a film, or for vidsrc.to
 * onto the shorter movie lineup that drops it.
 *
 * Falling back to the first player rather than to nothing is the rule the TV
 * app already follows (`players.indexOfFirst { … }.coerceAtLeast(0)` in
 * `player/PlayerActivity.kt`), and the surfaces have to agree: a preference
 * that resolved differently here would play a title on a different provider
 * depending on which one opened it.
 */
export function serverIndexById(servers: StreamServer[], id: string | null | undefined) {
  const index = servers.findIndex((server) => server.id === id);
  return index < 0 ? 0 : index;
}

// vidlink player options (see vidlink.pro docs): match the app accent, and
// autostart playback when requested. "Play next" is handled by WatchView via the
// player's `ended` event rather than vidlink's in-iframe button, so our episode
// state stays in sync with what is playing.
function vidlinkOpts(_autoplay?: boolean) {
  const searchParams = new URLSearchParams(
    "primaryColor=2563eb&secondaryColor=a2a2a2&iconColor=eefdec&icons=vid&player=jw&title=true&poster=true&nextbutton=true",
  );
  // autoplay makes it start on mute
  // if (autoplay) searchParams.append("autoplay", "true");
  return searchParams.toString();
}

export const vidLink: StreamServer = {
  id: "vidlink",
  name: "Main Player",
  getMovieLink: (tmdbId, opts) => `https://vidlink.pro/movie/${tmdbId}?${vidlinkOpts(opts?.autoplay)}`,
  getEpisodeLink: (tmdbId, season, episode, opts) =>
    `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?${vidlinkOpts(opts?.autoplay)}`,
};

export const vidSrcMe: StreamServer = {
  id: "vidsrc-embed",
  name: "Alternate Player",
  getMovieLink: (tmdbId) => `https://vidsrc-embed.ru/embed/movie?tmdb=${tmdbId}&ds_lang=${LANGUAGE}`,
  getEpisodeLink: (tmdbId, season, episode) =>
    `https://vidsrc-embed.ru/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}&ds_lang=${LANGUAGE}`,
};

export const vidSrcTo: StreamServer = {
  id: "vidsrc-to",
  name: "Backup Player",
  getMovieLink: (tmdbId) => `https://vidsrc.to/embed/movie/${tmdbId}?ds_lang=${LANGUAGE}`,
  getEpisodeLink: (tmdbId, season, episode) => `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}?ds_lang=${LANGUAGE}`,
};

export const STREAM_SERVERS: StreamServer[] = [vidLink, vidSrcMe, vidSrcTo];

// Movies use the two most reliable players only (vidsrc.to is dropped here).
// vidlink leads: it carries the widest film catalogue of the three.
export const MOVIE_SERVERS: StreamServer[] = [vidLink, vidSrcMe];

/**
 * vidnest's anime player, keyed by AniList id with an explicit sub track. It
 * carries subbed sources the TMDB-based players often lack, so it takes the
 * main slot for anime. The episode number is the within-AniList-entry number
 * (matches the TMDB episode for single-cour seasons).
 */
export function vidnestAnime(anilistId: number): StreamServer {
  return {
    id: "vidnest",
    name: "Main Player",
    getMovieLink: () => `https://vidnest.fun/anime/${anilistId}/1/sub`,
    getEpisodeLink: (_tmdbId, _season, episode) => `https://vidnest.fun/anime/${anilistId}/${episode}/sub`,
  };
}

/**
 * Server lineup for anime: vidnest leads (most reliable for subbed anime), then
 * the TMDB-based players as fallbacks. vidsrc.to is intentionally dropped here.
 * Falls back to the standard lineup when the AniList id is unknown.
 *
 * The two below move down a slot and are relabelled for it, but keep the ids
 * they have everywhere else — the label is the position, the id is the
 * provider, and only the position has changed.
 */
export function getAnimeServers(anilistId: number | null): StreamServer[] {
  if (!anilistId) return STREAM_SERVERS;
  return [vidnestAnime(anilistId), { ...vidLink, name: "Alternate Player" }, { ...vidSrcMe, name: "Backup Player" }];
}
