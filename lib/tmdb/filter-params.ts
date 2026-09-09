import type { Metadata } from "next";
import {
  createLoader,
  createParser,
  createSerializer,
  parseAsArrayOf,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  type SearchParams,
} from "nuqs/server";
import { NETWORK_PARAM, networkFromExtra, networkParamValue, withoutUnsupportedNetwork, type Network } from "@/lib/networks";
import { SITE_NAME, pageMetadata } from "@/lib/seo";
import { MediaType } from "./queries";
import { DEFAULT_SORT, emptyFilters, type FilterState } from "./filters";

/**
 * A vertical bar is TMDB's own OR — `with_networks=49|3186` is how a brand TMDB files under two
 * ids (HBO Max, Paramount+) asks for both — and it is no more legal in a URI query than the braces
 * below. Left raw it is worse than illegible: a linkifier that stops at the bar hands over
 * `…?extra=%22with_networks%22:%2249`, which still answers 200 and parses to nothing, so the
 * reader lands on the page's first category instead of the network the link was sent to show.
 *
 * So the bar travels percent-encoded — and the percent sign that spells it is encoded too, which
 * is what keeps the escaping reversible: an `extra` value whose own text is `PG%7C13` is written
 * `PG%257C13` and read back as itself, rather than arriving as `PG|13`. nuqs escapes these percent
 * signs again when it renders the query string, and decoding the URL once hands them back here.
 */
const ESCAPED_PIPE = "%7C";
const ESCAPED_PERCENT = "%25";
/** Case-insensitive, because percent-encoding is: a link lowercased in transit still reads. */
const ESCAPE_PATTERN = /%7c|%25/gi;

/**
 * `extra` carries preset-only params (region, certification, popularity bounds…)
 * through the URL as the *body* of a JSON object — the same JSON `parseAsJson`
 * would write, minus the braces it wraps that body in. `{` and `}` are not legal
 * in a URI query and are only tolerated by browsers, so a filter link carrying
 * them defeats naive link detection and can be mangled by anything stricter that
 * round-trips it. Beyond the braces and the reversible escaping above, the body
 * is untouched JSON, so keys and values of every shape round-trip exactly.
 */
const parseAsBracelessJson = createParser<Record<string, string | number>>({
  parse: (query) => {
    try {
      // One pass, so an unescaped percent sign cannot combine with the text after it into a second
      // escape. Links minted before the braces were dropped still carry them, and ones minted
      // before the bar was encoded still carry it raw; both spellings keep working.
      const body = query.replace(ESCAPE_PATTERN, (match) => (match.toLowerCase() === "%7c" ? "|" : "%"));
      const parsed: unknown = JSON.parse(body.startsWith("{") ? body : `{${body}}`);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed as Record<string, string | number>;
    } catch {
      return null;
    }
  },
  // Percent first: the bar's own escape is spelled with one, and escaping them the other way round
  // would encode it a second time.
  serialize: (value) => JSON.stringify(value).slice(1, -1).replace(/%/g, ESCAPED_PERCENT).replace(/\|/g, ESCAPED_PIPE),
  // Objects are compared by content, so an emptied `extra` still matches the
  // default and nuqs drops the key from the URL instead of writing `extra=`.
  eq: (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b),
});

/**
 * Single set of nuqs parsers shared by the client hook (BrowsePage's
 * `useQueryStates`) and the server loader (`loadFilters` in BrowsePageServer),
 * so SSR and the client agree on the filters parsed from the query string.
 */
export const filterParsers = {
  q: parseAsString.withDefault(""),
  genres: parseAsArrayOf(parseAsInteger).withDefault([]),
  sort: parseAsString.withDefault(DEFAULT_SORT),
  yearFrom: parseAsInteger,
  yearTo: parseAsInteger,
  minRating: parseAsFloat,
  minVotes: parseAsInteger,
  lang: parseAsString.withDefault(""),
  extra: parseAsBracelessJson.withDefault({}),
};

export const loadFilters = createLoader(filterParsers);

/**
 * Writes filter values back into a query string, spelled exactly as the app's own links spell them
 * — the home page's network tiles are minted with this same serializer (components/home/rails.ts),
 * so a canonical built here is character for character the URL the reader clicked.
 */
const serializeFilters = createSerializer(filterParsers);

/**
 * The one name a browse page goes by, from the state that page is showing: its <h1> and its
 * document title are two renderings of this single string, computed here rather than spelled out
 * on each side — the tab that disagreed with the heading under it was two spellings drifting apart.
 *
 * A network renames the page; nothing else does. That is safe because a `FilterState` only reaches
 * here through `valuesToFilterState`, which has already dropped a network a film URL carried, so no
 * film page can be headed "Netflix" over the film catalogue at large.
 */
export function browseHeading(q: string, filters: FilterState, section: string): string {
  // A whitespace-only `q` is no search, and the query prints as typed.
  if (q.trim()) return `Results for “${q}”`;
  return networkFromExtra(filters.extra)?.name ?? section;
}

export interface BrowseMetadataOptions {
  searchParams: SearchParams;
  /** The route's own name, and its title while nothing in the URL renames it. */
  section: string;
  mediaType: MediaType;
  /** The route's own path. The canonical is this plus whatever of the URL names the page. */
  path: string;
  /** Description for that unfiltered section; the states below speak for themselves instead. */
  description: string;
}

/**
 * The query string the canonical keeps: the parameters that name the page, and nothing else.
 *
 * The rule is that one — a canonical carries exactly what the title and the description are
 * resolved from — and it settles both halves of the problem at once. Keep too little and twelve
 * network cards all claim `/tv`: Facebook and LinkedIn key an object on `og:url`, so twelve
 * distinct cards collapse into one, and a card headed "Netflix" opens the unfiltered series
 * catalogue. Keep too much and every incidental refinement mints another canonical — a sort order,
 * a year range and a rating floor multiply out to thousands of addresses for one page, all of them
 * carrying the same title and the same words underneath.
 *
 * So a search and a network are kept: each renames the page and its description (see
 * `browseHeading`), and each is a page someone means to send. A genre, a category, a sort, a year
 * or a rating floor is dropped: those narrow the same catalogue without renaming it, so they are
 * views of the section and belong to it — minting a separate address for each while every one of
 * their cards still read "Movies" would be the collapse above in reverse. This is handed the very
 * values the title and the description are built from, so the address and the name are read off one
 * resolution of the URL rather than kept in step by hand.
 *
 * The network is respelled from the brand rather than copied from the URL, so a link that lists a
 * two-id brand the other way round ("3186|49") canonicalises onto the tile's own spelling instead
 * of opening a second object for the same page. An id we hold no brand for names nothing, so it
 * drops out here exactly as it drops out of the heading.
 */
function canonicalQuery(searchQuery: string, network: Network | undefined): string {
  if (searchQuery) return serializeFilters({ q: searchQuery });
  if (network) return serializeFilters({ extra: { [NETWORK_PARAM]: networkParamValue(network) } });
  return "";
}

/**
 * The address a network's browse page goes by — the canonical `browseMetadata` mints for it, built
 * here from the same serializer so a second spelling of that URL cannot drift from the one the page
 * itself claims. The sitemap lists these, and a listed URL that canonicalises somewhere else asks
 * the crawler to discard the entry it has just read.
 *
 * The path is spelled in rather than passed: `with_networks` is TV-only (see lib/networks.ts), so
 * every network page in this app is a view of /tv and there is no other route to point at.
 */
export function networkBrowsePath(network: Network): string {
  return `/tv${canonicalQuery("", network)}`;
}

/**
 * What a search on a browse route actually returns, and the route that owns those results.
 *
 * TMDB's search endpoints take no filters, and BrowsePage runs exactly one of them per media type,
 * so `?q=` on /anime returns the same unfiltered series /tv returns, in the same order. The page
 * called that "Anime matching …" under a canonical and an `og:url` of its own, which made
 * /anime?q=batman a byte-identical duplicate of /tv?q=batman making a claim its own results did not
 * support — and platforms that key a share on `og:url` filed the two as separate objects.
 *
 * Scoping the search instead was the other way out, and is not available: with no genre or language
 * parameter on /search/tv, the anime filter could only be applied by discarding results after the
 * fetch, which would leave the title count, the pagination and the empty state each lying in a new
 * way. So the claim goes rather than the results — a search names the section it really searched,
 * and canonicalises onto that section's own address.
 */
const SEARCH_SCOPE: Record<MediaType, { section: string; path: string }> = {
  [MediaType.movie]: { section: "Movies", path: "/movies" },
  [MediaType.tv]: { section: "TV Shows", path: "/tv" },
};

/**
 * Title and link-preview metadata for a browse route, resolved from the state its URL is showing.
 *
 * The document title names the page — several open searches, or twelve open network pages, are
 * otherwise indistinguishable in the tab bar and in history — and `pageMetadata` carries that same
 * name into `og:title` and `twitter:title`, which are the only titles an unfurler reads. The
 * network rail exists to be shared, so twelve links that previewed identically as the site name
 * defeated the point of minting them.
 *
 * The description follows the state as the heading does, and is written for someone who has not
 * clicked yet: it names the site, which the subtitle sitting under the heading has no reason to. A
 * category or a genre leaves it — and the title — as the section's own, because neither renames the
 * page (see `browseHeading`), so the preview and the tab agree there too.
 *
 * The address the card carries follows that same state, through `canonicalQuery` — a card is a
 * name, a sentence and a destination, and the three have to be of one page. Naming twelve networks
 * over a destination of `/tv` left the reader who clicked one in the unfiltered catalogue, and left
 * the platforms that key on that destination filing all twelve as the same object.
 *
 * Filter changes after the cold load arrive shallowly, so `generateMetadata` never runs again for
 * them and BrowsePage keeps the title in step from the client; both go through `browseHeading`. A
 * shared link has no client to keep it in step, which is why the preview is resolved from the URL.
 */
export function browseMetadata({ searchParams, section, mediaType, path, description }: BrowseMetadataOptions): Metadata {
  const values = loadFilters(searchParams);
  // A bare URL falls back to the page's first category, which carries no network — so what the
  // fallback is cannot change the answer, and the presets need not be handed over for it.
  const filters = valuesToFilterState(values, emptyFilters(), mediaType);
  // Trimmed for the canonical, which should not open a second address for a query that differs from
  // another only by the spaces around it; the title and the sentence below quote it as typed.
  const searchQuery = values.q.trim();
  // Same order of precedence the heading uses: a search names the page even with a network still
  // in the URL, so the two lines of the preview cannot describe different pages.
  const network = searchQuery ? undefined : networkFromExtra(filters.extra);
  // A search is answered by the media type's own section wherever it was typed, so both the sentence
  // and the address come from there rather than from this route (see SEARCH_SCOPE). For /movies and
  // /tv that is this route; for /anime it is /tv, which is the page whose results these are.
  const scope = SEARCH_SCOPE[mediaType];

  return {
    ...pageMetadata({
      title: browseHeading(values.q, filters, section),
      // Both open on the section, so its capital reads as the start of a sentence rather than as a
      // proper noun dropped mid-line. The query is quoted as typed, exactly as the heading quotes it.
      description: searchQuery
        ? `${scope.section} matching “${values.q}”, ready to stream free on ${SITE_NAME}.`
        : network
          ? `${section} from ${network.name}, ready to stream free on ${SITE_NAME}.`
          : description,
      path: `${searchQuery ? scope.path : path}${canonicalQuery(searchQuery, network)}`,
    }),
    // A search page is worth sharing — hence its own address above, and the card that names it —
    // but not indexing: the set of queries is open, so a crawler that followed them would file an
    // endless run of pages assembled from a catalogue it can already reach through the sections.
    // `follow` stays on, so the titles found through a search are still crawled from here.
    ...(searchQuery ? { robots: { index: false, follow: true } } : {}),
  };
}

export interface FilterValues {
  q: string;
  genres: number[];
  sort: string;
  yearFrom: number | null;
  yearTo: number | null;
  minRating: number | null;
  minVotes: number | null;
  lang: string;
  extra: Record<string, string | number>;
}

/** Whether a state asks for nothing the default page would not (search `q` is ignored here). */
function isUnfiltered(s: FilterState): boolean {
  return (
    s.genres.length === 0 &&
    s.sortBy === DEFAULT_SORT &&
    s.yearMin === undefined &&
    s.yearMax === undefined &&
    s.minRating === undefined &&
    s.minVotes === undefined &&
    !s.language &&
    Object.keys(s.extra ?? {}).length === 0
  );
}

/**
 * Build a FilterState from URL values; falls back to `fallback` when the URL has no filters.
 *
 * This is the only road from a query string to a FilterState, which is why the media type is
 * resolved here too rather than at the far end: the server component that prefetches the grid and
 * the client component that renders it both arrive through this function, so a filter one of them
 * cannot use (a network on a film page — see `withoutUnsupportedNetwork`) is gone before either
 * builds its discover variables, and the two agree on the React Query key.
 */
export function valuesToFilterState(v: FilterValues, fallback: FilterState, mediaType: MediaType): FilterState {
  const fromUrl = withoutUnsupportedNetwork(
    {
      genres: v.genres,
      sortBy: v.sort || DEFAULT_SORT,
      yearMin: v.yearFrom ?? undefined,
      yearMax: v.yearTo ?? undefined,
      minRating: v.minRating ?? undefined,
      minVotes: v.minVotes ?? undefined,
      language: v.lang || undefined,
      extra: v.extra ?? {},
    },
    mediaType,
  );
  // Whether anything is left is asked *after* the strip, never of the raw URL: a film link whose
  // only filter is a TV-only network (a shared link, a hand-edit, a section switch with a network
  // active) has nothing left once that goes, and judging it beforehand skipped this fallback and
  // put the whole million-title catalogue on screen under no category at all.
  return isUnfiltered(fromUrl) ? withoutUnsupportedNetwork(fallback, mediaType) : fromUrl;
}

/** Serialize a FilterState into URL values (nuqs clears values equal to their default). */
export function filterStateToValues(s: FilterState): Omit<FilterValues, "q"> {
  return {
    genres: s.genres,
    sort: s.sortBy || DEFAULT_SORT,
    yearFrom: s.yearMin ?? null,
    yearTo: s.yearMax ?? null,
    minRating: s.minRating ?? null,
    minVotes: s.minVotes ?? null,
    lang: s.language || "",
    extra: s.extra && Object.keys(s.extra).length ? s.extra : {},
  };
}
