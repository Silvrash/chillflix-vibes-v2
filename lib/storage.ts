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

/**
 * Bump this whenever the shape of anything stored here changes: state written
 * under an older version stops being readable at once, and is cleared out the
 * next time anything is written.
 *
 * Version 3 is where the player preference stopped being a position in the
 * lineup and became a provider id, which is why it no longer has to be bumped
 * for a reorder — a position meant a different provider after one, a provider
 * id does not.
 */
const SCHEMA_VERSION = "3";
const SCHEMA_KEY = "storage-schema";

let schemaChecked = false;

/**
 * Runs on the first write rather than at import time — module-level side
 * effects run during bundle evaluation, where a throw is fatal to the entire
 * page — and never on a read, because reads happen during render.
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

/**
 * Reading never writes. These reads are the snapshot behind a
 * `useSyncExternalStore`, and React calls a snapshot *during render* and
 * documents it as pure — so a read that ran the schema wipe would mean that
 * merely rendering the watch page cleared the viewer's resume points, on the
 * one visit where arriving is meant to touch nothing at all.
 *
 * State written under an older schema therefore reads as absent, which is the
 * answer the wipe would give anyway; the wipe itself waits for the next write.
 */
function read(key: string): string | undefined {
  try {
    const storage = store();
    if (!storage || storage.getItem(SCHEMA_KEY) !== SCHEMA_VERSION) return undefined;
    return storage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * The positions are numbers and the player preference is not, so parsing is the
 * caller's business rather than every read's. It used to be every read's, which
 * a string value would have come back from as `undefined` — a stored provider
 * id parses as `NaN`.
 */
function readNumber(key: string): number | undefined {
  const value = read(key);
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function write(key: string, value: string | number) {
  try {
    ensureSchema();
    store()?.setItem(key, String(value));
  } catch {
    // Quota, private mode, or storage disabled — not worth breaking playback.
  }
}

export function getLastWatched(type: MediaType | string, id: string | number) {
  return {
    season: readNumber(seasonKey(type, id)),
    episode: readNumber(episodeKey(type, id)),
  };
}

export function setLastWatched(type: MediaType | string, id: string | number, season: number, episode: number) {
  write(seasonKey(type, id), season);
  write(episodeKey(type, id), episode);
}

/**
 * Remembers the player the user last picked, so it's preselected on the next
 * title. Stored globally, and by provider id rather than by position: a
 * position meant "whatever leads the lineup here", which is a different
 * provider on an anime title than on anything else, so carrying one between the
 * two silently changed what it asked for. The caller resolves the id against
 * the lineup in front of it (`serverIndexById`), and one that isn't in it falls
 * back to the main player.
 *
 * Remembering only: which player is playing right now is the watch page's own
 * state, because this can silently fail and a viewer whose provider is broken
 * still has to be able to switch.
 */
const PREFERRED_SERVER_KEY = "preferred-player";

export function getPreferredServer(): string | undefined {
  return read(PREFERRED_SERVER_KEY);
}

export function setPreferredServer(id: string) {
  write(PREFERRED_SERVER_KEY, id);
}
