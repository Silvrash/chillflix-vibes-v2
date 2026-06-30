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
