"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NETWORKS,
  NETWORK_PARAM,
  networkFromExtra,
  networkKey,
  networkParamValue,
  supportsNetworks,
  type Network,
} from "@/lib/networks";
import { MediaType, type Genre } from "@/lib/tmdb/queries";
import type { Preset } from "@/lib/presets";
import { filterStateToParams, presetToFilterState, type FilterState } from "@/lib/tmdb/filters";

export interface BrowseSidebarProps {
  mediaType: MediaType;
  animeOnly?: boolean;
  presets: Preset[];
  genres: Genre[];
  filters: FilterState;
  /**
   * Defaults to a pushed history entry: in the always-visible desktop sidebar,
   * picking a category or a genre is one deliberate step Back should undo. The
   * sheet composes several picks before it closes, so it passes its own history
   * mode instead of taking that default.
   */
  onChange: (next: FilterState, history?: "push" | "replace") => void;
}

/** Below this the category rail is a sheet; at or above it, the desktop aside. Matches Tailwind's `lg`. */
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * The persistent category rail: curated presets on top, then genres, then — on
 * the series pages only — networks.
 *
 * It owns no state of its own — every click writes straight through to the
 * URL-backed FilterState, and the active row is derived back out of it. That is
 * what keeps a shared link, the back button and the sidebar telling the same
 * story.
 *
 * The three lists compose rather than replace each other: a category sets the
 * sort/era/rating baseline, genres and a network narrow it, and the category row
 * stays lit while they do.
 */
export function BrowseSidebar(props: BrowseSidebarProps) {
  const { presets, filters } = props;
  const { activeNetwork, activePreset, genreOptions, selectPreset, toggleGenre, toggleNetwork } = useBrowseSelection(props);
  const listRef = useRef<HTMLDivElement>(null);
  const atEnd = useScrolledToEnd(listRef);

  return (
    <aside className="hidden shrink-0 lg:sticky lg:top-24 lg:block lg:w-56 xl:w-64">
      {/* The negative inset gives TV mode's 6px focus ring room: the scroll container
          clips horizontally too, and would otherwise shave the ring off every row. */}
      <div className="relative -mx-1.5">
        {/* The list is taller than the viewport, so it scrolls inside the sticky box —
            a sticky element taller than the screen would leave its bottom unreachable.
            Hence a real (thin) scrollbar here rather than the hidden one the rails use. */}
        <div
          ref={listRef}
          className="max-h-[calc(100vh-8rem)] overflow-y-auto px-1.5 pb-10 [scrollbar-color:rgba(255,255,255,0.25)_transparent] [scrollbar-width:thin]"
        >
          <SectionHeading>Categories</SectionHeading>
          <CategoryList presets={presets} activePreset={activePreset} onSelect={selectPreset} />

          <SectionHeading className="pt-6">Genres</SectionHeading>
          <GenreList genres={genreOptions} selected={filters.genres} onToggle={toggleGenre} />

          {supportsNetworks(props.mediaType) && (
            <>
              <SectionHeading className="pt-6">Networks</SectionHeading>
              <NetworkList active={activeNetwork} onToggle={toggleNetwork} />
            </>
          )}
        </div>

        {/* Over half the genre list sits below the fold on a laptop, and an overlay
            scrollbar only appears once you already scrolled. The fade is the cue. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background via-background/80 to-transparent transition-opacity duration-200",
            atEnd ? "opacity-0" : "opacity-100",
          )}
        />
      </div>
    </aside>
  );
}

/**
 * The same lists for narrow screens, behind a bottom sheet. Rendered separately
 * from <BrowseSidebar> so the trigger can sit in the main column's control row,
 * under the page title, instead of above it.
 */
export function BrowseCategoryPicker(props: BrowseSidebarProps) {
  const { presets, filters, animeOnly } = props;
  const [open, setOpen] = useState(false);

  // One visit to the sheet is one step back: the first pick pushes a history
  // entry and every later one folds into it. The sheet stays open across a whole
  // composition — a category and a handful of genres — so pushing each of them
  // would leave the Back button replaying half-built filter states behind a sheet
  // that is no longer on screen, with the page the user arrived from buried under
  // the pile. Same bargain the advanced-filter sheet strikes in FilterBar.
  const picked = useRef(false);

  const commit = (next: FilterState) => {
    props.onChange(next, picked.current ? "replace" : "push");
    picked.current = true;
  };

  const { activeNetwork, activePreset, genreOptions, selectPreset, toggleGenre, toggleNetwork } = useBrowseSelection({
    ...props,
    onChange: commit,
  });

  // The sheet portals to <body>, where this wrapper's `lg:hidden` cannot reach
  // it: resizing (or rotating a tablet) past the breakpoint would otherwise
  // strand it over the desktop layout, with the body still scroll-locked.
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia(DESKTOP_QUERY);
    if (desktop.matches) {
      setOpen(false);
      return;
    }
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [open]);

  const genreCount = filters.genres.filter((id) => !(animeOnly && id === 16)).length;
  const label = [
    activePreset ? categoryLabel(activePreset) : "Custom selection",
    activeNetwork?.name ?? "",
    genreCount ? `${genreCount} genre${genreCount > 1 ? "s" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="w-full sm:w-64 lg:hidden">
      <button
        type="button"
        onClick={() => {
          picked.current = false;
          setOpen(true);
        }}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-left text-sm font-semibold backdrop-blur-xl transition-colors hover:bg-white/15"
      >
        <span className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted" />
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <SectionHeading>Categories</SectionHeading>
        <CategoryList presets={presets} activePreset={activePreset} onSelect={selectPreset} />

        <SectionHeading className="pt-6">Genres</SectionHeading>
        <GenreList genres={genreOptions} selected={filters.genres} onToggle={toggleGenre} />

        {supportsNetworks(props.mediaType) && (
          <>
            <SectionHeading className="pt-6">Networks</SectionHeading>
            <NetworkList active={activeNetwork} onToggle={toggleNetwork} />
          </>
        )}
      </Sheet>
    </div>
  );
}

function useBrowseSelection({ mediaType, animeOnly, presets, genres, filters, onChange }: BrowseSidebarProps) {
  const currentParams = useMemo(() => filterStateToParams(filters, mediaType, animeOnly), [filters, mediaType, animeOnly]);

  const presetParams = useMemo(
    () =>
      presets.map((preset) => {
        const state = presetToFilterState(preset);
        return { preset, genres: state.genres, params: filterStateToParams(state, mediaType, animeOnly) };
      }),
    [presets, mediaType, animeOnly],
  );

  // The category in play: the one whose every param a category actually owns
  // matches what we are sending. Genres and the network are held out of that
  // comparison because they compose on top of a category rather than define it —
  // no preset carries either, so leaving them in would mean no category could
  // ever be lit while one of them was chosen.
  const base = useMemo(
    () => presetParams.find(({ params }) => sameParams(withoutComposed(params), withoutComposed(currentParams))) ?? null,
    [presetParams, currentParams],
  );

  // Lit while its own genres are all still selected, so a category survives the
  // user ticking extra genres and goes dark the moment one of its own is
  // untoggled — or an advanced filter (sort, era, rating) pulls the state away.
  //
  // Asked of the genres the viewer holds, never of the ones the query carries:
  // the anime page adds genre 16 to every request it makes, and a bare network
  // link would otherwise satisfy "Popular Animated"'s own 16 with a genre the
  // page injected — lighting a category nobody picked, while /tv, injecting
  // nothing, lit none for the same link.
  const activePreset = base && base.genres.every((id) => filters.genres.includes(id)) ? base.preset.name : null;

  // Genres the user ticked on top of the category in play. The category's own
  // genres belong to it, so they are not carried over to the next one.
  const pickedGenres = useMemo(() => {
    const owned = base ? base.genres : [];
    return filters.genres.filter((id) => !owned.includes(id));
  }, [base, filters.genres]);

  // Genre 16 (Animation) is always applied on the anime page, so hide it here.
  const genreOptions = useMemo(() => (animeOnly ? genres.filter((g) => g.id !== 16) : genres), [genres, animeOnly]);

  // The network in play. On a film page there is never one: `with_networks` is
  // TV-only, and `withoutUnsupportedNetwork` strips it there rather than let the
  // page claim a filter TMDB ignored.
  const activeNetwork = networkFromExtra(filters.extra);

  // A category replaces the whole state (it carries its own sort, rating and
  // preset-only `extra` params) but keeps the genres and the network the user
  // picked: the sheet stays open on purpose so a category and a few genres can be
  // composed in one pass, and its opaque backdrop would hide those checks being
  // wiped. The network survives for the same reason genres do — it is a lens over
  // whatever category is running, not one of the things a category decides.
  const selectPreset = (preset: Preset) => {
    const next = presetToFilterState(preset);
    next.genres = [...next.genres, ...pickedGenres.filter((id) => !next.genres.includes(id))];
    if (activeNetwork) next.extra = { ...(next.extra ?? {}), [NETWORK_PARAM]: networkParamValue(activeNetwork) };
    onChange(next);
  };

  const toggleGenre = (id: number) => {
    const has = filters.genres.includes(id);
    onChange({ ...filters, genres: has ? filters.genres.filter((g) => g !== id) : [...filters.genres, id] });
  };

  // One network at a time: TMDB would take a pipe-joined list, but a row of
  // checkboxes reading "Netflix or HBO Max or Hulu" is a query, and the point of
  // this section is to answer "what is on Netflix" in one click. Picking the lit
  // one again clears it.
  const toggleNetwork = (network: Network) => {
    const extra = { ...(filters.extra ?? {}) };
    if (activeNetwork && networkKey(activeNetwork) === networkKey(network)) delete extra[NETWORK_PARAM];
    else extra[NETWORK_PARAM] = networkParamValue(network);
    onChange({ ...filters, extra });
  };

  return { activeNetwork, activePreset, genreOptions, selectPreset, toggleGenre, toggleNetwork };
}

/** Whether a scroll container is at its bottom, so a "there is more" cue can take itself away. */
function useScrolledToEnd(ref: RefObject<HTMLElement>) {
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => setAtEnd(element.scrollTop + element.clientHeight >= element.scrollHeight - 4);
    update();

    element.addEventListener("scroll", update, { passive: true });
    // The box is viewport-height bound, so a window resize changes the answer
    // without anyone scrolling.
    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [ref]);

  return atEnd;
}

function CategoryList({
  presets,
  activePreset,
  onSelect,
}: {
  presets: Preset[];
  activePreset: string | null;
  onSelect: (preset: Preset) => void;
}) {
  return (
    <nav aria-label="Categories" className="flex flex-col gap-0.5">
      {presets.map((preset) => {
        const active = preset.name === activePreset;
        return (
          <button
            key={preset.name}
            type="button"
            onClick={() => onSelect(preset)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-xl px-3 py-2 text-left text-sm leading-snug transition-colors",
              active ? "bg-white/10 font-semibold text-white" : "text-muted hover:bg-white/5 hover:text-white",
            )}
          >
            {categoryLabel(preset.name)}
          </button>
        );
      })}
    </nav>
  );
}

function GenreList({ genres, selected, onToggle }: { genres: Genre[]; selected: number[]; onToggle: (id: number) => void }) {
  return (
    <nav aria-label="Genres" className="flex flex-col gap-0.5">
      {genres.map((genre) => {
        const active = selected.includes(genre.id);
        return (
          <button
            key={genre.id}
            type="button"
            onClick={() => onToggle(genre.id)}
            aria-pressed={active}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm leading-snug transition-colors",
              active ? "bg-white/10 font-semibold text-white" : "text-muted hover:bg-white/5 hover:text-white",
            )}
          >
            <span className="truncate">{genre.name}</span>
            {active && <Check className="h-4 w-4 shrink-0" />}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * The networks, as a single-choice list. Same row treatment as the genres above
 * it, because it reads the same way: a lens laid over whatever category is
 * running, lit while it applies.
 *
 * The names are spelled out rather than drawn as logos — the home page's tiles
 * have room to render a wordmark legibly, a 14rem-wide sidebar row does not.
 */
function NetworkList({ active, onToggle }: { active: Network | undefined; onToggle: (network: Network) => void }) {
  return (
    <nav aria-label="Networks" className="flex flex-col gap-0.5">
      {NETWORKS.map((network) => {
        const selected = active !== undefined && networkKey(active) === networkKey(network);
        return (
          <button
            key={networkKey(network)}
            type="button"
            onClick={() => onToggle(network)}
            aria-pressed={selected}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm leading-snug transition-colors",
              selected ? "bg-white/10 font-semibold text-white" : "text-muted hover:bg-white/5 hover:text-white",
            )}
          >
            <span className="truncate">{network.name}</span>
            {selected && <Check className="h-4 w-4 shrink-0" />}
          </button>
        );
      })}
    </nav>
  );
}

function SectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted", className)}>{children}</h2>;
}

function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // The picker spells `onClose` as a fresh arrow function per render, and the effect below hands
  // focus back to the opener as it tears down — so keying it on that identity would pull the
  // caller out of the sheet on every category and genre picked inside it.
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") latestClose.current();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Everything behind the sheet goes inert: it takes the page out of the tab order and, on the
    // TV build, stops the D-pad's geometry search from driving focus into content the backdrop is
    // covering. Same declaration the search overlay and the trailer dialog make.
    const inerted: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement) || child.contains(rootRef.current) || child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      inerted.push(child);
    }

    // An overlay that opens without taking focus leaves it on the trigger it is now covering, and
    // gives the sheet nothing to hand back when it closes.
    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      // Order matters: focus() is a silent no-op on a node that is still inert, and the viewer
      // would be left on <body>, where the next arrow press starts again from the top of the page.
      for (const node of inerted) node.removeAttribute("inert");
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Browse"
      className="fixed inset-0 z-[60] flex items-end justify-center"
    >
      <div className="absolute inset-0 animate-fade-in bg-black/70" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full animate-slide-up flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-black/60 backdrop-blur-2xl">
        <div className="shrink-0 px-4 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/15" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold">Browse</h2>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close browse menu"
              className="rounded-xl p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">{children}</div>

        <div className="shrink-0 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
          >
            Show results
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Presets are named as prose ("Recommended Movies", "Romantic Comedies on TV").
// The sidebar is already scoped to one media type, so that tail is noise on
// every single row.
const MEDIA_TAIL = /\s+(?:Movies|TV Shows|on TV)$/i;

function categoryLabel(name: string): string {
  return name.replace(MEDIA_TAIL, "");
}

type DiscoverParams = Record<string, string | number | boolean>;

const GENRE_PARAM = "with_genres";

/** The params that compose on top of a category, so are not part of deciding which one is lit. */
function withoutComposed(params: DiscoverParams): DiscoverParams {
  const rest = { ...params };
  delete rest[GENRE_PARAM];
  delete rest[NETWORK_PARAM];
  return rest;
}

function sameParams(a: DiscoverParams, b: DiscoverParams): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => String(a[key]) === String(b[key]));
}
