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
  getMovieLink: (tmdbId, opts) => `https://vidlink.pro/movie/${tmdbId}?${vidlinkOpts(opts?.autoplay)}`,
  getEpisodeLink: (tmdbId, season, episode, opts) =>
    `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?${vidlinkOpts(opts?.autoplay)}`,
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
