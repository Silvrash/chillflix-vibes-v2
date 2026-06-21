/**
 * Embed-URL builders for the streaming providers. Playback is delivered as an
 * <iframe> pointing at these embed pages, so the web app simply needs the URL.
 *
 * The original native app probed each domain with a HEAD request to find a live
 * one; that fails under browser CORS, so we just use a known-good default domain
 * per provider and expose them as selectable "servers".
 */

const LANGUAGE = "en";

export interface StreamServer {
  name: string;
  getMovieLink: (tmdbId: number | string) => string;
  getEpisodeLink: (tmdbId: number | string, season: number | string, episode: number | string) => string;
}

export const vidSrcMe: StreamServer = {
  name: "Main Server",
  getMovieLink: (tmdbId) => `https://vidsrc.me/embed/movie?tmdb=${tmdbId}&ds_lang=${LANGUAGE}`,
  getEpisodeLink: (tmdbId, season, episode) =>
    `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}&ds_lang=${LANGUAGE}`,
};

export const vidSrcTo: StreamServer = {
  name: "Alternative Server",
  getMovieLink: (tmdbId) => `https://vidsrc.to/embed/movie/${tmdbId}?ds_lang=${LANGUAGE}`,
  getEpisodeLink: (tmdbId, season, episode) => `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}?ds_lang=${LANGUAGE}`,
};

export const STREAM_SERVERS: StreamServer[] = [vidSrcMe, vidSrcTo];
