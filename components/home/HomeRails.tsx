import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";
import { MediaType } from "@/lib/tmdb/queries";
import { DiscoverRail } from "./DiscoverRail";
import { Hero } from "./Hero";
import { NetworkRail } from "./NetworkRail";
import { ShownTitlesProvider } from "./shown-titles";
import { TrendingRail } from "./TrendingRail";
import { WatchlistRail } from "./WatchlistRail";
import { HOME_DISCOVER_RAILS, HOME_NETWORK_TILES } from "./rails";

/**
 * Who keeps a title two rows both drew (./shown-titles.tsx): lowest number wins it. This is a
 * ranking of claims, not the order the rows are drawn in and not where they sit on the page — the
 * Top 10s come first, ahead of the hero that renders above them, because their heading is a claim
 * about TMDB's ranking and they are the only rows on the page that can give nothing up.
 *
 * The hero counts as a row too — it rotates through eight titles off the very feed the first Top 10
 * draws from, so without this the top of that row is the carousel again, poster for poster. It does
 * not take its exclusion from this registry, though, which is published from an effect and so is
 * empty while the server renders; it drops the ranked ten straight off the shared trending response
 * (./rail-items.ts). The rows this registry really carries are the /discover ones below the fold,
 * whose server HTML is a skeleton either way.
 */
const ORDER = { watchlist: 0, topMovies: 1, topShows: 2, hero: 3, firstDiscover: 4 };

/**
 * The home page: a hero to look at, then curated rows to browse. Filtering lives on /movies,
 * /tv and /anime — this page never asks the visitor to build a query.
 *
 * The rows are spaced with `space-y` (margins) rather than a flex gap on purpose: a rail that
 * failed to load renders nothing, and its margins then collapse instead of leaving a gap where
 * the row would have been.
 *
 * Each row is handed the rank of its claim (`order`) rather than that being read off the order the
 * rails arrive in: they fetch independently and land out of turn, and it is the rank — decided here,
 * above — that settles which of two rows keeps a title they both drew (./shown-titles.tsx).
 */
export function HomeRails() {
  return (
    <div>
      {/* The one heading on the site's canonical URL that says what the page is. Hidden rather than
          drawn because on screen the hero's artwork already is the headline — and the titles over
          that artwork are captions, not headings, or eight films that turn over hourly would be
          competing with this for the page's name. */}
      <h1 className="sr-only">
        {SITE_NAME} — {SITE_TAGLINE}
      </h1>

      {/* The hero is inside the provider, not above it: it publishes what it is featuring so the
          rows below drop those titles, and a row outside the provider claims nothing at all. */}
      <ShownTitlesProvider>
        {/* The navbar floats over the page, and here it floats over the hero's artwork on purpose.
            With trending down the hero renders nothing at all, so this minimum stands in for it:
            together with the rails' own `pt-8` it clears the navbar pill by the same margin every
            other route does with `pt-24 sm:pt-28`. */}
        <div className="min-h-16 sm:min-h-20">
          <Hero order={ORDER.hero} mediaType={MediaType.movie} rankedBelow />
        </div>

        <div className="mx-auto max-w-[1600px] space-y-10 px-4 pb-16 pt-8 sm:space-y-12 sm:px-6 lg:px-10">
          {/* Ways in, before the things to watch — and it takes no `order` because it shows no
              titles at all, so there is nothing for the registry above to arbitrate. Its heading
              names the media type because the filter behind it only exists for series
              (./NetworkRail.tsx, lib/networks.ts). */}
          <NetworkRail title="TV Shows by Network" tiles={HOME_NETWORK_TILES} />

          {/* Ahead of the Top 10s deliberately: a list the viewer built by hand outranks a
              ranking, and it renders nothing at all when signed out or empty. */}
          <WatchlistRail order={ORDER.watchlist} />

          <TrendingRail order={ORDER.topMovies} title="Top 10 Movies" mediaType={MediaType.movie} href="/movies" />
          <TrendingRail order={ORDER.topShows} title="Top 10 TV Shows" mediaType={MediaType.tv} href="/tv" />

          {HOME_DISCOVER_RAILS.map((rail, index) => (
            <DiscoverRail key={rail.title} order={index + ORDER.firstDiscover} {...rail} />
          ))}
        </div>
      </ShownTitlesProvider>
    </div>
  );
}
