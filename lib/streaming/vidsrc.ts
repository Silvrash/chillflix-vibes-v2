/**
 * Embed-URL builders for the streaming providers. Playback is delivered as an
 * <iframe> pointing at these embed pages, so the web app simply needs the URL.
 *
 * vidlink.pro is the primary player: it autoplays and serves Japanese (subbed)
 * audio for anime straight from its /tv endpoint. It also emits PLAYER_EVENT
 * messages that WatchView uses to auto-advance to the next episode. The vidsrc
 * domains are kept as fallback servers.
 */

const LANGUAGE = "en";

export interface StreamOptions {
  /** Only vidlink honours this; autostarts playback when true. */
  autoplay?: boolean;
}

export interface StreamServer {
  name: string;
  getMovieLink: (tmdbId: number | string, opts?: StreamOptions) => string;
  getEpisodeLink: (tmdbId: number | string, season: number | string, episode: number | string, opts?: StreamOptions) => string;
}

// vidlink player options (see vidlink.pro docs): match the app accent, and
// autostart playback when requested. "Play next" is handled by WatchView via the
// player's `ended` event rather than vidlink's in-iframe button, so our episode
// state stays in sync with what is playing.
function vidlinkOpts(autoplay?: boolean) {
  return autoplay ? "primaryColor=2563eb&autoplay=true" : "primaryColor=2563eb";
}

export const vidLink: StreamServer = {
  name: "Player 1",
  getMovieLink: (tmdbId, opts) => `https://vidlink.pro/movie/${tmdbId}?player=jw&nextbutton=true&${vidlinkOpts(opts?.autoplay)}`,
  getEpisodeLink: (tmdbId, season, episode, opts) =>
    `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?player=jw&nextbutton=true&${vidlinkOpts(opts?.autoplay)}`,
};

export const vidSrcMe: StreamServer = {
  name: "Player 2",
  getMovieLink: (tmdbId) => `https://vidsrc-embed.ru/embed/movie?tmdb=${tmdbId}&ds_lang=${LANGUAGE}`,
  getEpisodeLink: (tmdbId, season, episode) =>
    `https://vidsrc-embed.ru/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}&ds_lang=${LANGUAGE}`,
};

export const vidSrcTo: StreamServer = {
  name: "Player 3",
  getMovieLink: (tmdbId) => `https://vidsrc.to/embed/movie/${tmdbId}?ds_lang=${LANGUAGE}`,
  getEpisodeLink: (tmdbId, season, episode) => `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}?ds_lang=${LANGUAGE}`,
};

export const STREAM_SERVERS: StreamServer[] = [vidLink, vidSrcMe, vidSrcTo];

/**
 * vidnest's anime player, keyed by AniList id with an explicit sub track. It
 * carries subbed sources the TMDB-based players often lack, so it's the primary
 * ("Player 1") choice for anime. The episode number is the within-AniList-entry
 * number (matches the TMDB episode for single-cour seasons).
 */
export function vidnestAnime(anilistId: number): StreamServer {
  return {
    name: "Player 1",
    getMovieLink: () => `https://vidnest.fun/anime/${anilistId}/1/sub`,
    getEpisodeLink: (_tmdbId, _season, episode) => `https://vidnest.fun/anime/${anilistId}/${episode}/sub`,
  };
}

/**
 * Server lineup for anime: vidnest leads (most reliable for subbed anime), then
 * the TMDB-based players as fallbacks. vidsrc.to is intentionally dropped here.
 * Falls back to the standard lineup when the AniList id is unknown.
 */
export function getAnimeServers(anilistId: number | null): StreamServer[] {
  if (!anilistId) return STREAM_SERVERS;
  return [vidnestAnime(anilistId), { ...vidLink, name: "Player 2" }, { ...vidSrcMe, name: "Player 3" }];
}
