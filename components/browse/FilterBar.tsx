"use client";

import { Select } from "@/components/ui/Select";
import { NETWORK_PARAM, findNetwork, supportsNetworks } from "@/lib/networks";
import {
  DEFAULT_SORT,
  LANGUAGE_OPTIONS,
  RATING_OPTIONS,
  YEAR_OPTIONS,
  emptyFilters,
  sortOptionsFor,
  type FilterState,
  type Option,
} from "@/lib/tmdb/filters";
import { MediaType } from "@/lib/tmdb/queries";
import { cn } from "@/lib/utils";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface FilterBarProps {
  mediaType: MediaType;
  filters: FilterState;
  onChange: (filters: FilterState, history?: "push" | "replace") => void;
  className?: string;
}

/**
 * The secondary, "advanced" filters. Categories, genres and networks moved to
 * the sidebar — this is only the long tail (sort, era, rating floor, language)
 * plus the preset-only params a curated category drags along in `extra`.
 */
export function FilterBar({ mediaType, filters, onChange, className }: FilterBarProps) {
  const [open, setOpen] = useState(false);

  // One visit to the sheet is one step back: the first edit pushes a history
  // entry and every later one folds into it, so Back returns to the filters the
  // sheet was opened with rather than replaying each dropdown. A focused <select>
  // can fire a change per arrow key, so pushing them all would bury the page the
  // user actually came from under a pile of states they only passed through.
  const edited = useRef(false);

  const applyFromSheet = (next: FilterState) => {
    onChange(next, edited.current ? "replace" : "push");
    edited.current = true;
  };
  const updateFromSheet = (patch: Partial<FilterState>) => applyFromSheet({ ...filters, ...patch });

  // Chips are single deliberate clicks, so each one is its own step back.
  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const extras = describeExtras(filters.extra, mediaType);

  // Reset undoes exactly what this bar owns and shows — the sheet's selects and
  // the chips beside it. Genres belong to the sidebar, which the sheet neither
  // displays nor speaks for, so they survive; the network is the sidebar's for
  // the same reason and survives with them. Clearing a category's era/rating/
  // `extra` still un-lights that category, because those values *are* what makes
  // it the category in play.
  const reset = () => applyFromSheet({ ...emptyFilters(), genres: filters.genres, extra: sidebarExtras(filters.extra, extras) });

  const activeCount = countActiveFilters(filters, extras.filter((extra) => !extra.sidebar).length);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>

      <Chip icon={<SlidersHorizontal className="h-4 w-4 text-muted" />} label="More filters" badge={activeCount > 0 ? activeCount.toString() : undefined} onClick={() => {
        edited.current = false;
        setOpen(true);
      }} />

      <FilterChips filters={filters} extras={extras} update={update} />

      <FilterModal
        open={open}
        activeCount={activeCount}
        showReset={activeCount > 0}
        onClose={() => setOpen(false)}
        onReset={reset}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Sort by"
            value={filters.sortBy}
            options={sortOptionsFor(mediaType)}
            onChange={(value) => updateFromSheet({ sortBy: value })}
          />
          <Select
            label="Language"
            value={filters.language ?? ""}
            options={LANGUAGE_OPTIONS}
            onChange={(value) => updateFromSheet({ language: value || undefined })}
          />
          <Select
            label="Year from"
            value={filters.yearMin ?? 0}
            options={[{ label: "Any", value: 0 }, ...YEAR_OPTIONS]}
            onChange={(value) => updateFromSheet({ yearMin: Number(value) || undefined })}
          />
          <Select
            label="Year to"
            value={filters.yearMax ?? 0}
            options={[{ label: "Any", value: 0 }, ...YEAR_OPTIONS]}
            onChange={(value) => updateFromSheet({ yearMax: Number(value) || undefined })}
          />
          <Select
            label="Min rating"
            value={filters.minRating ?? 0}
            options={ratingOptions(filters.minRating)}
            onChange={(value) => updateFromSheet({ minRating: Number(value) || undefined })}
          />
        </div>
      </FilterModal>
    </div>
  );
}

/**
 * Curated categories carry rating floors that are not on the menu (7.5, say).
 * With no option of its own the <select> silently falls back to "Any rating" and
 * contradicts the chip sitting right beside it.
 */
function ratingOptions(minRating?: number): Option<number>[] {
  if (!minRating || RATING_OPTIONS.some((option) => option.value === minRating)) return RATING_OPTIONS;
  return [...RATING_OPTIONS, { label: `${minRating}+`, value: minRating }].sort((a, b) => a.value - b.value);
}

/**
 * How many filters this bar is holding, and so what its badge, its sheet header
 * and its Reset button all answer to. Genres are the sidebar's job, so they are
 * deliberately not counted here — and, for the same reason, not reset. The
 * network is held out the same way: `extraCount` arrives with the sidebar's own
 * `extra` entries already taken out of it. Counting it would badge a filter the
 * sheet has no control for, and resetting it would throw away a choice made in a
 * list the open sheet is covering up.
 */
function countActiveFilters(filters: FilterState, extraCount: number): number {
  let n = extraCount;
  if (filters.yearMin || filters.yearMax) n += 1;
  if (filters.minRating) n += 1;
  // A vote floor set alongside a rating is that rating's companion, not a filter
  // of its own — see `filterStateToParams`, which invents one when it is missing.
  if (!filters.minRating && filters.minVotes) n += 1;
  if (filters.language) n += 1;
  if (filters.sortBy !== DEFAULT_SORT) n += 1;
  return n;
}

function FilterChips({
  filters,
  extras,
  update,
}: {
  filters: FilterState;
  extras: ExtraChip[];
  update: (patch: Partial<FilterState>) => void;
}) {
  const removeExtras = (keys: string[]) => {
    const next = { ...(filters.extra ?? {}) };
    for (const key of keys) delete next[key];
    update({ extra: next });
  };

  return (
    <>
      {(filters.yearMin || filters.yearMax) && (
        <Chip
          label={yearChipLabel(filters.yearMin, filters.yearMax)}
          onRemove={() => update({ yearMin: undefined, yearMax: undefined })}
        />
      )}
      {filters.minRating ? (
        <Chip
          label={`${filters.minRating}+ rating`}
          // The vote floor exists to keep the rating honest, so it leaves with it.
          onRemove={() => update({ minRating: undefined, minVotes: undefined })}
        />
      ) : null}
      {!filters.minRating && filters.minVotes ? (
        <Chip label={`${filters.minVotes.toLocaleString("en-US")}+ votes`} onRemove={() => update({ minVotes: undefined })} />
      ) : null}
      {filters.language && (
        <Chip
          label={LANGUAGE_OPTIONS.find((o) => o.value === filters.language)?.label ?? filters.language}
          onRemove={() => update({ language: undefined })}
        />
      )}
      {extras.map((extra) => (
        <Chip key={extra.keys.join(",")} label={extra.label} onRemove={() => removeExtras(extra.keys)} />
      ))}
    </>
  );
}

interface ExtraChip {
  label: string;
  /** Every `extra` key this chip stands for — removing it clears all of them. */
  keys: string[];
  /**
   * Set on a filter the sidebar owns and this bar only reports. It still gets a chip — that is
   * the only way to read it and drop it without going back to the list — but it is the one thing
   * the chip does here: the badge does not count it and Reset does not clear it.
   */
  sidebar?: boolean;
}

/**
 * The `extra` entries a Reset carries over: the ones the sidebar owns, read back out of the very
 * chips that flagged them, so what the badge skips and what Reset keeps can only ever be the same
 * set.
 */
function sidebarExtras(extra: FilterState["extra"], chips: ExtraChip[]): Record<string, string | number> {
  const kept: Record<string, string | number> = {};
  for (const chip of chips) {
    if (!chip.sidebar) continue;
    for (const key of chip.keys) {
      const value = extra?.[key];
      if (value !== undefined) kept[key] = value;
    }
  }
  return kept;
}

/** Named because the param has no control of its own; a user can only judge it by its chip. */
const EXTRA_LABELS: Record<string, (value: string | number) => string> = {
  region: (value) => `Released in ${String(value).toUpperCase()}`,
  certification_country: (value) => `Age ratings from ${String(value).toUpperCase()}`,
  "popularity.gte": (value) => `Popularity over ${value}`,
  "popularity.lte": (value) => `Popularity under ${value}`,
  "vote_count.lte": (value) => `Under ${value} votes`,
};

const COMPARATORS: Record<string, string> = { gte: "at least", lte: "at most" };

/**
 * Turn the preset-only params in `extra` into chips a user can read and drop one
 * at a time. They arrive as raw TMDB discover keys (region, certification.lte,
 * …), so without a phrasebook the most this bar could say was "+1 preset filter"
 * — a chip that named nothing and could only be cleared wholesale, while every
 * chip beside it said what it was.
 */
function describeExtras(extra: FilterState["extra"], mediaType: MediaType): ExtraChip[] {
  if (!extra) return [];

  const entries = Object.entries(extra).filter(([, value]) => value !== undefined && value !== null && value !== "");
  const chips: ExtraChip[] = [];

  const certification = certificationChip(Object.fromEntries(entries));
  if (certification) chips.push(certification);

  const network = networkChip(extra, mediaType);
  if (network) chips.push(network);

  for (const [key, value] of entries) {
    if (certification?.keys.includes(key) || network?.keys.includes(key)) continue;
    chips.push({ label: EXTRA_LABELS[key]?.(value) ?? genericExtraLabel(key, value), keys: [key] });
  }

  return chips;
}

/**
 * The network filter, named. It reaches `extra` as a bare TMDB id (or a pipe-joined pair), which
 * the generic phrasing below can only render as "Networks: 213" — the number a visitor arriving
 * from the home page's network row least needs to see.
 *
 * TV only, because the parameter is: `withoutUnsupportedNetwork` drops it from a film page's
 * filters entirely rather than let a chip claim a filter TMDB silently ignored, so on that page
 * there is nothing here to name. An id we hold no brand for falls through to the generic label,
 * which at least still says a network filter is in play and lets it be removed — and, being
 * unnamed, is not one of the sidebar's rows either, so this bar counts and resets it as its own.
 */
function networkChip(extra: Record<string, string | number>, mediaType: MediaType): ExtraChip | null {
  if (!supportsNetworks(mediaType)) return null;
  const network = findNetwork(extra[NETWORK_PARAM]);
  return network ? { label: `On ${network.name}`, keys: [NETWORK_PARAM], sidebar: true } : null;
}

/**
 * TMDB ignores a certification without `certification_country`, so the pair is
 * one filter wearing two keys and has to be shown — and removed — as one.
 */
function certificationChip(extra: Record<string, string | number>): ExtraChip | null {
  const keys = Object.keys(extra).filter((key) => key.startsWith("certification"));
  const label =
    extra["certification.lte"] !== undefined
      ? `Rated ${extra["certification.lte"]} or lower`
      : extra["certification.gte"] !== undefined
        ? `Rated ${extra["certification.gte"]} or higher`
        : extra.certification !== undefined
          ? `Rated ${extra.certification}`
          : null;

  return label ? { label, keys } : null;
}

/** Last resort for a preset param with no phrasing of its own: readable beats raw JSON. */
function genericExtraLabel(key: string, value: string | number): string {
  const dot = key.lastIndexOf(".");
  const comparator = dot > 0 ? COMPARATORS[key.slice(dot + 1)] : undefined;
  const name = (comparator ? key.slice(0, dot) : key).replace(/^with_/, "").replace(/_/g, " ");
  const head = name.charAt(0).toUpperCase() + name.slice(1);
  return comparator ? `${head} ${comparator} ${value}` : `${head}: ${value}`;
}

function FilterModal({
  open,
  activeCount,
  showReset,
  onClose,
  onReset,
  children,
}: {
  open: boolean;
  activeCount: number;
  showReset: boolean;
  onClose: () => void;
  onReset: () => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // The bar spells `onClose` as a fresh arrow function per render, and the effect below hands
  // focus back to the opener as it tears down — so keying it on that identity would pull the
  // caller out of the sheet on every filter the sheet itself changes.
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
    // Bottom sheet on mobile, centred dialog on desktop.
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="More filters"
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
    >
      <div className="absolute inset-0 animate-fade-in bg-black/70" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full animate-slide-up flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-black/60 backdrop-blur-2xl sm:max-h-[85vh] sm:max-w-xl sm:animate-pop-in sm:rounded-2xl">
        <div className="shrink-0 px-5 pb-4 pt-4">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/15 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold sm:text-lg">More filters{activeCount > 0 ? ` · ${activeCount}` : ""}</h2>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="rounded-xl p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        <div className="flex shrink-0 items-center gap-3 border-t border-white/10 px-5 py-3.5">
          <button
            type="button"
            onClick={onReset}
            disabled={!showReset}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium backdrop-blur-xl transition-colors",
              showReset ? "text-accent hover:bg-white/15 hover:text-white" : "cursor-not-allowed text-muted/40",
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90 sm:ml-auto sm:flex-none"
          >
            Show results
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function yearChipLabel(min?: number, max?: number): string {
  if (min && max) return `${min}–${max}`;
  if (min) return `From ${min}`;
  return `Until ${max}`;
}

function Chip({ label, onRemove, onClick, badge, icon }: { label: string; onRemove?: () => void; onClick?: () => void; badge?: string; icon?: ReactNode }) {
  return (
    <span className={cn("flex items-center gap-1 rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-accent", onClick && "cursor-pointer")} onClick={onClick}>
      {icon}
      {label}
      {badge && (
        <span className="rounded-lg bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold text-white">{badge}</span>
      )}
      {onRemove && (
        <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="text-accent/70 hover:text-white">
          <X className="h-3 w-3" />
        </button>
      )}

    </span>
  );
}
