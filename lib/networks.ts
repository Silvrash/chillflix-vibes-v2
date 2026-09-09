/**
 * The networks and streamers the home page offers as a row of tiles, and that the browse page has
 * to be able to name again once one of them is in the URL.
 *
 * Static on purpose: a row of twelve tiles that resolved its own logos would cost twelve TMDB
 * round trips before the page could paint, to render a list that changes about once a year. The
 * ids and logo paths below were read off TMDB's own /network/{id} responses.
 *
 * `with_networks` is a TV-only parameter — TMDB does not merely ignore it on /discover/movie, it
 * answers with the entire unfiltered film catalogue — so everything here is scoped to series, and
 * the only URLs the app mints from it point at /tv.
 */

import type { FilterState } from "@/lib/tmdb/filters";
import { MediaType } from "@/lib/tmdb/queries";

/** The TMDB /discover key these tiles filter on. TV only; see the note above. */
export const NETWORK_PARAM = "with_networks";

/**
 * Whether a browse page can offer networks at all — the single place the TV-only rule is decided,
 * so the sidebar's Networks section, the filter chip and the guard below cannot drift apart.
 */
export function supportsNetworks(mediaType: MediaType): boolean {
  return mediaType !== MediaType.movie;
}

/**
 * Drops a network filter that reached a page whose media type cannot use it.
 *
 * TMDB does not fail on `with_networks` at /discover/movie — it ignores it and answers with the
 * entire unfiltered film catalogue. Left in the state, a hand-written or stale link would head the
 * page "Netflix", chip it "On Netflix", and put every film TMDB holds underneath. Nothing the app
 * mints points there (see components/home/rails.ts); this is the guard for links that were not
 * minted by it.
 *
 * It lives here, and is applied inside `valuesToFilterState`, because both sides of the page have
 * to honour it: the server prefetches the grid from the URL and the client asks for it again, and
 * a guard only one of them ran would leave them on two different React Query keys — an empty grid
 * on first paint plus a dehydrated page nothing reads.
 *
 * The state is returned untouched when there is nothing to drop, so the normal film page keeps the
 * identity the discover query is memoised on.
 */
export function withoutUnsupportedNetwork(state: FilterState, mediaType: MediaType): FilterState {
  if (supportsNetworks(mediaType) || state.extra?.[NETWORK_PARAM] === undefined) return state;
  const extra = { ...state.extra };
  delete extra[NETWORK_PARAM];
  return { ...state, extra };
}

export interface Network {
  name: string;
  /**
   * The TMDB network ids this brand covers. Usually one; a brand that TMDB still files under two
   * (HBO and HBO Max, Paramount+ and the CBS All Access it grew out of) lists both, and they are
   * sent as TMDB's own OR — a pipe — so the tile shows the whole brand rather than half of it.
   */
  tmdbIds: number[];
  /** TMDB `logo_path`, resolved through getTMDBImageUrl at a logo size. */
  logoPath: string;
}

/**
 * Ordered as a viewer would look for them: the streamers people subscribe to first, then the
 * channels behind a lot of the catalogue's best-known series.
 *
 * Every entry earns its tile by having a catalogue behind it — the smallest of these returns some
 * 80 series, and TMDB carries plenty of networks (Crunchyroll's own entry returns 19) that would
 * put a tile on the home page leading to almost nothing.
 */
export const NETWORKS: Network[] = [
  { name: "Netflix", tmdbIds: [213], logoPath: "/wwemzKWzjKYJFfCeiB57q3r4Bcm.png" },
  { name: "Prime Video", tmdbIds: [1024], logoPath: "/w7HfLNm9CWwRmAMU58udl2L7We7.png" },
  { name: "Disney+", tmdbIds: [2739], logoPath: "/1edZOYAfoyZyZ3rklNSiUpXX30Q.png" },
  { name: "HBO Max", tmdbIds: [49, 3186], logoPath: "/nmU0UMDJB3dRRQSTUqawzF2Od1a.png" },
  // TMDB files it as plain "Apple TV"; the service has been Apple TV+ throughout, so the tile says so.
  { name: "Apple TV+", tmdbIds: [2552], logoPath: "/bngHRFi794mnMq34gfVcm9nDxN1.png" },
  { name: "Hulu", tmdbIds: [453], logoPath: "/pqUTCleNUiTLAVlelGxUgWn1ELh.png" },
  { name: "Paramount+", tmdbIds: [4330, 1709], logoPath: "/fi83B1oztoS47xxcemFdPMhIzK.png" },
  { name: "Peacock", tmdbIds: [3353], logoPath: "/gIAcGTjKKr0KOHL5s4O36roJ8p7.png" },
  { name: "AMC", tmdbIds: [174], logoPath: "/pmvRmATOCaDykE6JrVoeYxlFHw3.png" },
  { name: "FX", tmdbIds: [88], logoPath: "/aexGjtcs42DgRtZh7zOxayiry4J.png" },
  { name: "BBC One", tmdbIds: [4], logoPath: "/uJjcCg3O4DMEjM0xtno9OWFciRP.png" },
  { name: "Adult Swim", tmdbIds: [80], logoPath: "/tHZPHOLc6iF27G34cAZGPsMtMSy.png" },
];

/**
 * What `with_networks` is set to for this brand. The pipe is TMDB's own OR and is what the API is
 * sent; it is not what a URL carries — see `parseAsBracelessJson` in lib/tmdb/filter-params.ts.
 */
export function networkParamValue(network: Network): string {
  return network.tmdbIds.join("|");
}

/** A stable React key for a tile or a row. TMDB ids are unique, so the first one will do. */
export function networkKey(network: Network): number {
  return network.tmdbIds[0];
}

/**
 * The brand a `with_networks` value names, or undefined for one we have no tile for — a
 * hand-written id, or a brand dropped from the list above.
 *
 * Undefined means "no name for it", and each caller answers that for itself rather than falling
 * back to a single house rule. Where the value would be read as the page's own name — the heading,
 * the line under it, the card and its canonical — it is dropped, because `with_networks=49|3186` is
 * not a name a reader or a share can use, and a page titled after a raw parameter is worse than one
 * titled after its section. Where it is read as a filter — FilterBar's chip — the raw value is
 * shown by the generic phrasing instead, so a filter nothing can name is still visible and still
 * removable, which is the way out of a page whose grid is narrower than its heading admits.
 *
 * That is also the cost of dropping a brand from NETWORKS: links already shared for it keep
 * filtering, but stop being able to say so. Retire an entry only alongside a redirect, or leave it
 * here unrendered.
 *
 * Ids are compared as a set so a link that lists a multi-id brand the other way round
 * ("3186|49") still resolves; TMDB treats the pipe as an unordered OR.
 */
export function findNetwork(value: string | number | undefined | null): Network | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const wanted = idSet(String(value));
  return NETWORKS.find((network) => sameIds(idSet(networkParamValue(network)), wanted));
}

/** The brand named by a FilterState's `extra` bag, if any. */
export function networkFromExtra(extra: Record<string, string | number> | undefined): Network | undefined {
  return findNetwork(extra?.[NETWORK_PARAM]);
}

function idSet(value: string): Set<string> {
  return new Set(value.split("|").map((id) => id.trim()));
}

function sameIds(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id));
}
