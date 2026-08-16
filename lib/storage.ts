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

/**
 * Every access is guarded. Reaching for `localStorage` throws outright in some
 * browsers — private modes, storage disabled, and several smart-TV browsers —
 * and this module is imported at the top of the watch page, so an exception
 * here takes the whole bundle down and the page renders nothing at all.
 * Losing a resume position is survivable; losing the page is not.
 */
function store(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function read(key: string): number | undefined {
  try {
    ensureSchema();
    const value = store()?.getItem(key);
    if (!value) return undefined;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  } catch {
    return undefined;
  }
}

function write(key: string, value: number) {
  try {
    ensureSchema();
    store()?.setItem(key, String(value));
  } catch {
    // Quota, private mode, or storage disabled — not worth breaking playback.
  }
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

/**
 * Remembers the player (server) the user last picked, so it's preselected on the
 * next title. Stored globally by index — the "Player 1 / 2" labels line up
 * across lineups — and clamped by the caller to the current server list.
 */
const PREFERRED_SERVER_KEY = "preferred-player";

/**
 * Playback state is keyed by *position* in the player lineup, so reordering
 * that lineup silently repoints every saved preference at a different
 * provider. Bump this whenever the lineup or the stored shape changes and the
 * next visit clears the stale state instead of resuming against it.
 */
const SCHEMA_VERSION = "2";
const SCHEMA_KEY = "storage-schema";

let schemaChecked = false;

/**
 * Runs on first use rather than at import time — module-level side effects run
 * during bundle evaluation, where a throw is fatal to the entire page.
 */
function ensureSchema() {
  if (schemaChecked) return;
  schemaChecked = true;
  const storage = store();
  if (!storage) return;
  try {
    if (storage.getItem(SCHEMA_KEY) !== SCHEMA_VERSION) {
      storage.clear();
      storage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
    }
  } catch {
    // Nothing to migrate if we can't reach storage.
  }
}

export function getPreferredServer(): number | undefined {
  return read(PREFERRED_SERVER_KEY);
}

export function setPreferredServer(index: number) {
  write(PREFERRED_SERVER_KEY, index);
}
