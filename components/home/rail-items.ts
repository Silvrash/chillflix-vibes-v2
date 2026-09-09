/**
 * Item helpers shared by the home rails — the client rows and the Server Component that composes
 * them.
 *
 * Deliberately import-free. The rail catalogue in ./rails.ts reaches the whole preset list and the
 * filter serializers; anything a "use client" rail imports from there would be shipped to the
 * browser to run a config array the browser never reads.
 */

/** A poster-less title renders as a text tile — tolerable in a grid, a hole in a curated row. */
export function withPoster<T extends { poster_path?: string }>(items: T[]): T[] {
  return items.filter((item) => Boolean(item.poster_path));
}

/** How many titles a ranked row shows. Its heading is a factual claim, and so is this count. */
export const TOP_N = 10;

/**
 * The head of a trending feed in TMDB's own ranking: what a "Top 10" row draws — and so exactly
 * what the hero above it, reading the same feed, has to leave alone.
 *
 * Both rows work this out from the one trending response they share rather than one of them telling
 * the other what it took. A row publishes its claim from an effect (./shown-titles.tsx), effects do
 * not run while the server renders, and a split that only exists in the browser is a page that
 * ships the duplicate row in its HTML and swaps it out on hydration.
 *
 * Poster-less titles go first, for the reason `withPoster` exists at all: the row cannot draw them,
 * so they are neither among the ten it shows nor among the ten it holds back.
 */
export function topRanked<T extends { poster_path?: string }>(items: T[]): T[] {
  return withPoster(items).slice(0, TOP_N);
}
