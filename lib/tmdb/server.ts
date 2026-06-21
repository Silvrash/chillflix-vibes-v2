import "server-only";

import type { MediaType } from "./queries";

/**
 * Server-only TMDB fetchers used by Server Components to prefetch data for SSR
 * hydration. These hit TMDB directly with the bearer token and rely on the
 * Next.js Data Cache (`next: { revalidate, tags }`) so responses are cached
 * across requests/users/deploys and refreshed in the background (ISR / SWR).
 *
 * They return raw TMDB JSON — the exact same shape the `/api/tmdb` proxy
 * returns to the browser — so the values can seed React Query under the same
 * query keys the client hooks use.
 */
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const HOUR = 3600;
const DAY = 86400;

type Params = Record<string, string | number | boolean | undefined | null>;

async function tmdbFetch<T>(path: string, params: Params, opts: { revalidate: number; tags: string[] }): Promise<T> {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) throw new Error("TMDB_API_TOKEN is not configured on the server.");

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  const url = `${TMDB_BASE_URL}/${path}${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    next: { revalidate: opts.revalidate, tags: opts.tags },
  });

  if (!res.ok) throw new Error(`TMDB request failed (${res.status}) for ${path}`);
  return res.json() as Promise<T>;
}

export function getTrending<T>(mediaType: MediaType, timeWindow: "day" | "week" = "day") {
  return tmdbFetch<T>(`trending/${mediaType}/${timeWindow}`, {}, { revalidate: HOUR, tags: ["tmdb", "trending"] });
}

export function discover<T>(mediaType: MediaType, params: Params) {
  return tmdbFetch<T>(`discover/${mediaType}`, params, { revalidate: HOUR, tags: ["tmdb", "discover"] });
}

export function getGenres(mediaType: MediaType) {
  return tmdbFetch<{ genres: { id: number; name: string }[] }>(
    `genre/${mediaType}/list`,
    {},
    { revalidate: DAY, tags: ["tmdb", "genres"] },
  );
}

export function getDetails<T>(mediaType: MediaType, id: number, append?: string) {
  return tmdbFetch<T>(
    `${mediaType}/${id}`,
    { append_to_response: append },
    { revalidate: DAY, tags: ["tmdb", "details", `${mediaType}-${id}`] },
  );
}
