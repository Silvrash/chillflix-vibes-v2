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

/**
 * Two of TMDB's lists as one row, taken in turn rather than one after the other.
 *
 * Every account collection arrives split into films and series — TMDB has no combined endpoint —
 * while the viewer thinks of it as a single list. Concatenating the halves is not merely untidy: a
 * rail caps what it draws, so a full page of films fills the cap on its own and the series behind
 * them can never appear at all. A watchlist of thirty films and four shows would render as a row
 * with no shows in it.
 *
 * Taking one from each in turn keeps both halves visible and leaves the order TMDB returned intact
 * within each — which is the ordering that carries the meaning, whether it is recency or relevance.
 */
export function interleave<A, B>(first: A[], second: B[]): (A | B)[] {
  // Two type parameters, not one: a film and a series are different shapes, and inferring a single
  // T from the first argument would make the second have to satisfy it.
  const merged: (A | B)[] = [];
  for (let index = 0; index < Math.max(first.length, second.length); index += 1) {
    if (index < first.length) merged.push(first[index]);
    if (index < second.length) merged.push(second[index]);
  }
  return merged;
}
