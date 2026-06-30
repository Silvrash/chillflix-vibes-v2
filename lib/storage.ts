import { MediaType } from "./tmdb/queries";

/**
 * Persists the last-watched season/episode per title in localStorage so the
 * watch page resumes where the user left off (replaces the native AsyncStorage).
 */

function seasonKey(type: MediaType | string, id: string | number) {
  return `${type}-${id}-season`;
}

function episodeKey(type: MediaType | string, id: string | number) {
  return `${type}-${id}-episode`;
}

function read(key: string): number | undefined {
  if (typeof window === "undefined") return undefined;
  const value = window.localStorage.getItem(key);
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function write(key: string, value: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, String(value));
}

export function getLastWatched(type: MediaType | string, id: string | number) {
  return {
    season: read(seasonKey(type, id)),
    episode: read(episodeKey(type, id)),
  };
}

export function setLastWatched(type: MediaType | string, id: string | number, season: number, episode: number) {
  write(seasonKey(type, id), season);
  write(episodeKey(type, id), episode);
}

/** Playback preferences (autoplay, auto-play-next), shared across all titles. */
export interface PlaybackPrefs {
  autoplay: boolean;
  playNext: boolean;
}

const PLAYBACK_PREFS_KEY = "playback-prefs";

export function getPlaybackPrefs(): PlaybackPrefs {
  const fallback: PlaybackPrefs = { autoplay: true, playNext: true };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PLAYBACK_PREFS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PlaybackPrefs>;
    // Missing keys default to on.
    return { autoplay: parsed.autoplay !== false, playNext: parsed.playNext !== false };
  } catch {
    return fallback;
  }
}

export function setPlaybackPrefs(prefs: PlaybackPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLAYBACK_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore write failures (e.g. private-mode quota).
  }
}
