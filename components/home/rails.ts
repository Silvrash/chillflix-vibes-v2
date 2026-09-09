import "server-only";
import { createSerializer } from "nuqs/server";
import { NETWORKS, NETWORK_PARAM, networkKey, networkParamValue } from "@/lib/networks";
import { moviePresets, tvPresets, type Preset } from "@/lib/presets";
import { filterStateToParams, presetToFilterState } from "@/lib/tmdb/filters";
import { filterParsers, filterStateToValues } from "@/lib/tmdb/filter-params";
import { MediaType } from "@/lib/tmdb/queries";

export interface HomeRail {
  title: string;
  mediaType: MediaType;
  /** The browse URL this rail is a sample of — same category, filters and all. */
  href: string;
  variables: Record<string, string | number | boolean>;
}

/** Writes a FilterState into a browse URL the way BrowsePage does, so the grid opens on it. */
const serializeFilters = createSerializer(filterParsers);

interface RailSource {
  /** The browse category this row runs, by name — see lib/presets.ts. */
  category: string;
  mediaType: MediaType;
  /** The browse page behind "See all", with the category list a bare URL there falls back to. */
  browse: { path: string; presets: Preset[] };
  /** Overrides the category's own name where it would not read as a heading (the anime row). */
  title?: string;
  animeOnly?: boolean;
}

const movies = { path: "/movies", presets: moviePresets };
const shows = { path: "/tv", presets: tvPresets };
const anime = { path: "/anime", presets: tvPresets };

/**
 * The curated rows under the two Top 10s, in the order they are drawn.
 *
 * Each one answers a question the rows above it cannot: the Top 10s are what is trending right now,
 * these are the anime shelf, the best-rated films of decades past, an action shelf, and the
 * animation that sold the most tickets. What used to put the same posters on the page twice was
 * sorting a second and a third row by popularity a few hundred ranks below the Top 10 — a rating, a
 * genre or an era is a different question, a popularity rank is the same question asked again.
 * Where two rows do land on the same title anyway, ./shown-titles.tsx drops it from the lower one:
 * hence anime, the third thing the navbar offers, before the genre shelves that would take from it.
 */
const RAIL_SOURCES: RailSource[] = [
  // The anime page's own first category: recent, well-rated series — which is what "Recommended"
  // names here. Its heading says the media type the other three state for themselves.
  { category: "Recommended TV Shows", title: "Recommended Anime", mediaType: MediaType.tv, browse: anime, animeOnly: true },
  { category: "Top Rated Classics", mediaType: MediaType.movie, browse: movies },
  { category: "Thrilling Action Shows", mediaType: MediaType.tv, browse: shows },
  { category: "Animated Blockbusters", mediaType: MediaType.movie, browse: movies },
];

/**
 * The rows themselves. Each is built from the same FilterState the browse page builds from that
 * category, so the rail and the grid behind "See all" share a React Query key: following the link
 * lands on a grid whose first page is already in the cache, showing the titles the row just showed,
 * with the category lit in the browse sidebar.
 *
 * Only the Server Component that resolves these ever imports the values — the rails receive them as
 * props — and `server-only` above holds that line: this module drags the whole preset catalogue and
 * the filter serializers in with it, none of which the browser has any use for.
 */
export const HOME_DISCOVER_RAILS: HomeRail[] = RAIL_SOURCES.flatMap(({ category, mediaType, browse, title, animeOnly }) => {
  // A category renamed out of the catalogue loses its row rather than taking the home page down.
  const preset = browse.presets.find((candidate) => candidate.name === category);
  if (!preset) return [];

  const filters = presetToFilterState(preset);
  // A bare browse URL already means "the first category", so only the others need spelling out.
  const query = preset === browse.presets[0] ? "" : serializeFilters(filterStateToValues(filters));

  return [
    {
      title: title ?? preset.name,
      mediaType,
      href: `${browse.path}${query}`,
      variables: filterStateToParams(filters, mediaType, animeOnly),
    },
  ];
});

export interface HomeNetworkTile {
  /** TMDB's own id for the brand — the rail keys its items by it, and nothing else reads it. */
  id: number;
  name: string;
  /** TMDB `logo_path`; the tile resolves it through getTMDBImageUrl. */
  logoPath: string;
  /** The browse URL this tile opens: the series catalogue filtered to this network. */
  href: string;
}

/**
 * The network tiles, as browse URLs.
 *
 * A network is not a category — it has no entry in lib/presets.ts and no row in the browse
 * sidebar's category list — but it reaches the grid the same way one does: a `Preset` shape through
 * `presetToFilterState` and the shared serializer, so the URL is spelled exactly as BrowsePage
 * spells its own and the two agree on the React Query key. That is the whole point of building the
 * links here rather than by hand: BrowsePageServer prefetches the first page from that URL, and a
 * link a character off would land on a grid that has to fetch it all over again.
 *
 * `with_networks` is TV-only (see lib/networks.ts), so every one of these points at /tv. There is
 * deliberately no movie equivalent: TMDB answers /discover/movie?with_networks= with the whole
 * unfiltered catalogue, which would put a page headed "Netflix" over every film TMDB holds.
 */
export const HOME_NETWORK_TILES: HomeNetworkTile[] = NETWORKS.map((network) => {
  const filters = presetToFilterState({ name: network.name, filters: { [NETWORK_PARAM]: networkParamValue(network) } });

  return {
    id: networkKey(network),
    name: network.name,
    logoPath: network.logoPath,
    href: `/tv${serializeFilters(filterStateToValues(filters))}`,
  };
});
