"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaCard, type MediaCardItem, type MediaCardVariant } from "./MediaCard";

/**
 * Card shape plus the width it sits in. `compact` is a poster at the tighter search-overlay size;
 * `logo` is the brand-tile row, which is landscape-shaped but small — a row of marks to pick from,
 * not artwork to look at.
 */
export type MediaRailVariant = MediaCardVariant | "compact" | "logo";

const ITEM_WIDTH: Record<MediaRailVariant, string> = {
  // `tv-rail-item` is the hook globals.css uses to widen posters to 12rem for the couch; landscape
  // cards are the one shape already wider than that and would be shrunk by it.
  portrait: "tv-rail-item w-32 sm:w-36 md:w-40",
  landscape: "w-64 sm:w-72 md:w-80",
  compact: "tv-rail-item w-28 sm:w-32 md:w-36",
  // Narrower than the 12rem `tv-rail-item` sets, so unlike `landscape` this one wants the hook:
  // small enough to read as a chip on the web, widened back out for the couch.
  logo: "tv-rail-item w-36 sm:w-40 md:w-44",
};

const CARD_VARIANT: Record<MediaRailVariant, MediaCardVariant> = {
  portrait: "portrait",
  landscape: "landscape",
  compact: "portrait",
  // Never consulted: every `logo` row supplies its own `renderItem`.
  logo: "landscape",
};

const SCROLLER = "no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 sm:gap-4";

const CHEVRON =
  "hidden rounded-xl border border-white/10 bg-white/10 p-1.5 backdrop-blur-xl transition-colors hover:bg-white/20 disabled:opacity-30 md:flex";

interface MediaRailBaseProps {
  title?: string;
  variant?: MediaRailVariant;
  /** Renders a "See all" link beside the heading. */
  href?: string;
  /** Numbers the posters and marks the row up as an ordered list. */
  ranked?: boolean;
  onEndReached?: () => void;
  className?: string;
}

/**
 * A row whose items MediaCard cannot draw supplies its own `renderItem`: the search overlay's
 * results do, because MediaCard wraps every poster in a HoverPreview that portals to <body> at
 * z-[100] and would float a second card over the dialog.
 */
export type MediaRailProps<T extends { id: number } = MediaCardItem> = MediaRailBaseProps &
  ({ items: MediaCardItem[]; renderItem?: undefined } | { items: T[]; renderItem: (item: T, index: number) => ReactNode });

/** The one horizontal rail: home rows, detail-page rows and the search overlay's rows are all this. */
export function MediaRail<T extends { id: number } = MediaCardItem>(props: MediaRailProps<T>) {
  const { title, variant = "portrait", href, ranked, onEndReached, className } = props;
  // The union of item arrays is not itself mappable, but every item carries an id, and that is all
  // the rail needs of them.
  const items: readonly { id: number }[] = props.items;

  const scrollerRef = useRef<HTMLElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const updateEdges = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const start = node.scrollLeft > 8;
    const end = node.scrollWidth - node.clientWidth - node.scrollLeft > 8;
    // Scrolling fires this every frame; returning the same object keeps those frames from
    // re-rendering the whole row of cards for a value that did not change.
    setEdges((previous) => (previous.start === start && previous.end === end ? previous : { start, end }));
  }, []);

  // A rail that pages in more titles has scroll room it did not have a moment ago, and a new search
  // query swaps the whole row out.
  useEffect(() => {
    updateEdges();
  }, [items, updateEdges]);

  function scrollByPage(direction: 1 | -1) {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth * 0.8, behavior: "smooth" });
  }

  function handleScroll() {
    updateEdges();
    const node = scrollerRef.current;
    if (!node || !onEndReached) return;
    if (node.scrollLeft + node.clientWidth >= node.scrollWidth - 400) onEndReached();
  }

  if (!items.length) return null;

  function drawItems(): { id: number; body: ReactNode }[] {
    if (props.renderItem) {
      const { items: own, renderItem } = props;
      return own.map((item, index) => ({ id: item.id, body: renderItem(item, index) }));
    }
    return props.items.map((item) => ({
      id: item.id,
      body: <MediaCard item={item} variant={CARD_VARIANT[variant]} />,
    }));
  }

  const cards = drawItems().map(({ id, body }, index) => (
    // Recommendation, similar and discover rails all page in, and TMDB can repeat an id across pages.
    <li key={`${id}-${index}`} className={cn("group/item relative shrink-0 snap-start", ITEM_WIDTH[variant])}>
      {body}
      {ranked && <Rank position={index + 1} />}
    </li>
  ));

  const listProps = {
    ref: (node: HTMLElement | null) => {
      scrollerRef.current = node;
    },
    onScroll: handleScroll,
    className: SCROLLER,
  };

  const pageLeft = <PageButton direction={-1} title={title} disabled={!edges.start} onClick={() => scrollByPage(-1)} />;
  const pageRight = <PageButton direction={1} title={title} disabled={!edges.end} onClick={() => scrollByPage(1)} />;
  const hasHeading = Boolean(title || href);

  return (
    <section className={cn("relative", className)}>
      {/* Whether the row can scroll is only known from a measurement taken after the first paint, so
          nothing whose presence depends on that measurement may take up space: the row would paint,
          then jump as the chevrons landed. Both arrangements below hold their height from the first
          paint — the header is drawn whether or not the chevrons inside it are usable, and the
          floating pair is out of flow entirely. */}
      {hasHeading && (
        <RailHeader title={title}>
          {href && (
            <Link href={href} className="flex items-center gap-0.5 text-sm text-muted transition-colors hover:text-white">
              See all
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
          {pageLeft}
          {pageRight}
        </RailHeader>
      )}

      <div className="relative">
        {/* A ranked row is an <ol> so the order is in the markup and not only in the numerals. */}
        {ranked ? <ol {...listProps}>{cards}</ol> : <ul {...listProps}>{cards}</ul>}

        {edges.start && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent" />
        )}
        {edges.end && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />
        )}

        {/* A rail with neither title nor "See all" has no heading of its own to hang chevrons from,
            and an empty header bar would stack one under the heading its caller already drew (the
            detail page's Cast and Crew sections). They ride the row's own edges instead, out of
            flow, appearing with the fade on the side that has more to show — the same measurement
            the fade already waits for, and one that costs nothing to wait for out here.
            The span is what is positioned, never the button: TV mode gives a focused control
            `position: relative`, which would drop an absolutely placed chevron back into the flow
            the moment the D-pad reached it. */}
        {!hasHeading && edges.start && (
          <span className="absolute inset-y-0 left-1 z-20 hidden items-center md:flex">{pageLeft}</span>
        )}
        {!hasHeading && edges.end && (
          <span className="absolute inset-y-0 right-1 z-20 hidden items-center md:flex">{pageRight}</span>
        )}
      </div>
    </section>
  );
}

/**
 * One page of travel in a direction. Disabled at the matching end on purpose: spatial-nav skips
 * disabled buttons, so D-pad focus never lands on a chevron that would do nothing.
 */
function PageButton({
  direction,
  title,
  disabled,
  onClick,
}: {
  direction: 1 | -1;
  title?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const forward = direction === 1;
  const side = forward ? "right" : "left";
  const Icon = forward ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title ? `Scroll ${title} ${side}` : `Scroll ${side}`}
      className={CHEVRON}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/**
 * Placeholder of the same height, so a rail arriving late doesn't shove the page down. Callers
 * standing in for a rail that has no heading of its own leave `title` out, because the rail they
 * are waiting on will not draw a header row either.
 */
export function MediaRailSkeleton({ title, count = 8 }: { title?: string; count?: number }) {
  return (
    <section>
      {title && <RailHeader title={title} />}
      <div className="flex gap-3 overflow-hidden pb-2 sm:gap-4">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className={cn("shrink-0", ITEM_WIDTH.portrait)}>
            <div className="aspect-[2/3] animate-pulse rounded-xl bg-surface-light" />
            {/* Boxed to the height of the card's real title and meta lines, so the rail arriving
                moves nothing. */}
            <div className="mt-2.5 flex h-5 items-center">
              <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface-light" />
            </div>
            <div className="mt-0.5 flex h-4 items-center">
              <div className="h-3 w-2/5 animate-pulse rounded bg-surface-light" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The spacer stands in for a missing title so "See all" and the chevrons stay against the far edge. */
function RailHeader({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 sm:mb-4">
      {title ? <h2 className="text-xl font-bold sm:text-2xl">{title}</h2> : <span />}
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

/**
 * The numeral covers the poster exactly — same width, same 2:3 box — so it can sit in the corner
 * of the artwork without the rail having to know how tall a card is. It is decorative: the
 * ordering is already in the <ol>, and pointer-events-none keeps it clear of the card's link.
 *
 * z-30 is what keeps it visible under a D-pad: TV mode lifts the focused link to z-20 (globals.css
 * `html.tv a:focus`), which would paint the poster over its own rank on the one card the viewer is
 * looking at. It stays below the navbar (z-50) and the hover preview (z-100).
 */
function Rank({ position }: { position: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-30 aspect-[2/3] overflow-hidden rounded-xl transition duration-200 group-hover/item:scale-[1.03] group-focus-within/item:scale-[1.03]"
    >
      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      {/* The scrim cannot darken pale artwork enough to carry white text, and which of the ten
          posters is pale changes every time the list rotates, so the numeral brings its own contrast
          instead of borrowing it: an outline painted behind the fill, which leaves the glyph's weight
          intact where `paint-order` is honoured and only thins it slightly where it is not. */}
      <span className="absolute bottom-1 left-2 text-5xl font-black leading-none tracking-tighter text-white [paint-order:stroke] [-webkit-text-stroke:3px_rgba(0,0,0,0.7)] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
        {position}
      </span>
    </div>
  );
}
