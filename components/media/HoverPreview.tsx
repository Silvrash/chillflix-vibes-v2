"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Clapperboard, Star, Tv } from "lucide-react";
import { getTMDBGenre, getTMDBImageUrl } from "@/lib/tmdb/images";
import { getYear, normalizeRating } from "@/lib/utils";
import type { Movie, TVShow } from "@/lib/tmdb/queries";

const CARD_WIDTH = 340;
const MARGIN = 8;
const TOP_SAFE = 72; // clear the sticky navbar (h-16) + a little breathing room
const OPEN_DELAY = 320;

interface TriggerRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

/**
 * Wraps a media card and shows an aesthetic, no-fetch preview on hover. The
 * preview is portalled to <body> with fixed positioning so it's never clipped
 * by the grid's or rails' overflow, and only activates on hover-capable devices.
 * The card measures itself and clamps to the viewport so it never runs off-screen.
 */
export function HoverPreview({ item, children }: { item: Movie | TVShow; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [trigger, setTrigger] = useState<TriggerRect | null>(null);

  function open() {
    if (typeof window === "undefined" || !window.matchMedia?.("(hover: hover)").matches) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTrigger({ left: r.left, top: r.top, bottom: r.bottom, width: r.width });
    }, OPEN_DELAY);
  }

  function close() {
    clearTimeout(timer.current);
    setTrigger(null);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!trigger) return;
    const onMove = () => close();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [trigger]);

  return (
    <div ref={ref} onMouseEnter={open} onMouseLeave={close} onFocus={open} onBlur={close}>
      {children}
      {trigger && createPortal(<PreviewCard item={item} trigger={trigger} />, document.body)}
    </div>
  );
}

function PreviewCard({ item, trigger }: { item: Movie | TVShow; trigger: TriggerRect }) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Start hidden & off-screen, then measure and place before paint (no flash).
  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    left: -9999,
    top: 0,
    width: CARD_WIDTH,
    visibility: "hidden",
  });
  const [placedAbove, setPlacedAbove] = useState(false);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(CARD_WIDTH, vw - MARGIN * 2);
    const height = el.offsetHeight;

    // Horizontal: centre on the trigger, clamp into the viewport.
    let left = trigger.left + trigger.width / 2 - width / 2;
    left = Math.min(Math.max(left, MARGIN), vw - width - MARGIN);

    // Vertical: put it where there's room; prefer below, fall back to above.
    const spaceBelow = vh - trigger.bottom - MARGIN;
    const spaceAbove = trigger.top - TOP_SAFE;
    let above = false;
    let top: number;
    if (spaceBelow >= height) {
      top = trigger.bottom + MARGIN;
    } else if (spaceAbove >= height) {
      top = trigger.top - height - MARGIN;
      above = true;
    } else {
      above = spaceAbove > spaceBelow;
      top = above ? trigger.top - height - MARGIN : trigger.bottom + MARGIN;
    }

    // Final clamp so the card can never leave the viewport.
    const next: CSSProperties = { position: "fixed", left, width, visibility: "visible" };
    const available = vh - TOP_SAFE - MARGIN;
    if (height > available) {
      next.top = TOP_SAFE;
      next.maxHeight = available;
    } else {
      next.top = Math.min(Math.max(top, TOP_SAFE), vh - height - MARGIN);
    }

    setPlacedAbove(above);
    setStyle(next);
  }, [trigger]);

  const isMovie = "title" in item;
  const title = isMovie ? item.title : item.name;
  const year = getYear(isMovie ? item.release_date : item.first_air_date);
  const backdrop = getTMDBImageUrl(item.backdrop_path, "w780") || getTMDBImageUrl(item.poster_path, "w342");
  const genres = (item.genre_ids ?? [])
    .map((id) => getTMDBGenre(id))
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
  const language = item.original_language?.toUpperCase();

  return (
    <div
      ref={cardRef}
      aria-hidden
      style={{ ...style, transformOrigin: placedAbove ? "bottom center" : "top center" }}
      className="pointer-events-none z-[100] animate-pop-in overflow-hidden rounded-xl border border-white/10 bg-surface shadow-2xl shadow-black/60"
    >
      <div className="relative aspect-video w-full bg-surface-light">
        {backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backdrop} alt="" className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
          {isMovie ? <Clapperboard className="h-3 w-3" /> : <Tv className="h-3 w-3" />}
          {isMovie ? "Movie" : "TV"}
        </span>
      </div>

      <div className="space-y-2 p-3">
        <h3 className="line-clamp-1 text-sm font-bold leading-tight text-white">{title}</h3>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {item.vote_average > 0 && (
            <span className="flex items-center gap-1 font-semibold text-amber-300">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {normalizeRating(item.vote_average)}
            </span>
          )}
          {year && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {year}
            </span>
          )}
          {language && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide">{language}</span>
          )}
        </div>

        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {genres.map((name) => (
              <span key={name} className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                {name}
              </span>
            ))}
          </div>
        )}

        {item.overview ? (
          <p className="text-xs leading-relaxed text-white/70">{item.overview}</p>
        ) : (
          <p className="text-xs italic text-muted">No description available.</p>
        )}
      </div>
    </div>
  );
}
