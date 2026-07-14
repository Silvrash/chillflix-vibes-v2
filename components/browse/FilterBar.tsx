"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import { MediaType } from "@/lib/tmdb/queries";
import type { Preset } from "@/lib/presets";
import {
  type FilterState,
  DEFAULT_SORT,
  LANGUAGE_OPTIONS,
  RATING_OPTIONS,
  YEAR_OPTIONS,
  emptyFilters,
  filterStateToParams,
  hasActiveFilters,
  presetToFilterState,
  sortOptionsFor,
} from "@/lib/tmdb/filters";

export interface Genre {
  id: number;
  name: string;
}

interface FilterBarProps {
  mediaType: MediaType;
  animeOnly?: boolean;
  genres: Genre[];
  presets: Preset[];
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const CUSTOM_LABEL = "Custom filters";

export function FilterBar({ mediaType, animeOnly, genres, presets, filters, onChange }: FilterBarProps) {
  const [open, setOpen] = useState(false);

  // Genre 16 (Animation) is always applied on the anime page, so hide it from the picker.
  const genreOptions = useMemo(() => (animeOnly ? genres.filter((g) => g.id !== 16) : genres), [genres, animeOnly]);
  const genreName = useMemo(() => new Map(genres.map((g) => [g.id, g.name])), [genres]);

  // The "Quick picks" label reflects the active filters: a preset name when they
  // match one (e.g. straight after picking it), otherwise "Custom filters".
  const presetLabel = useMemo(() => {
    const current = filterStateToParams(filters, mediaType, animeOnly);
    const match = presets.find((p) => sameParams(filterStateToParams(presetToFilterState(p), mediaType, animeOnly), current));
    return match?.name ?? CUSTOM_LABEL;
  }, [filters, presets, mediaType, animeOnly]);

  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  function selectPreset(name: string) {
    const preset = presets.find((p) => p.name === name);
    if (preset) onChange(presetToFilterState(preset));
  }

  function toggleGenre(id: number) {
    const has = filters.genres.includes(id);
    update({ genres: has ? filters.genres.filter((g) => g !== id) : [...filters.genres, id] });
  }

  const reset = () => onChange(emptyFilters());
  const showReset = hasActiveFilters(filters, animeOnly);
  const activeCount = countActiveFilters(filters, animeOnly);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-white/10 bg-surface px-4 py-3 text-sm font-semibold transition-colors hover:border-white/20 sm:w-auto sm:justify-start sm:rounded-full sm:px-5 sm:py-2"
        >
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            Filters
            {activeCount > 0 && (
              <span className="rounded-full bg-primary-dark px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {activeCount}
              </span>
            )}
          </span>
          <span className="truncate text-xs font-normal text-muted sm:hidden">{presetLabel}</span>
        </button>

        <FilterChips filters={filters} animeOnly={animeOnly} genreName={genreName} update={update} toggleGenre={toggleGenre} />
      </div>

      <FilterModal open={open} activeCount={activeCount} showReset={showReset} onClose={() => setOpen(false)} onReset={reset}>
        <Section label="Quick picks" emoji="⚡">
          <Select
            value={presetLabel}
            options={[{ label: CUSTOM_LABEL, value: CUSTOM_LABEL }, ...presets.map((p) => ({ label: p.name, value: p.name }))]}
            onChange={(value) => {
              if (value !== CUSTOM_LABEL) selectPreset(value);
            }}
          />
        </Section>
        <FilterControls
          mediaType={mediaType}
          genreOptions={genreOptions}
          filters={filters}
          update={update}
          toggleGenre={toggleGenre}
        />
      </FilterModal>
    </div>
  );
}

function countActiveFilters(filters: FilterState, animeOnly?: boolean): number {
  let n = filters.genres.filter((id) => !(animeOnly && id === 16)).length;
  if (filters.yearMin || filters.yearMax) n += 1;
  if (filters.minRating) n += 1;
  if (filters.language) n += 1;
  if (filters.sortBy !== DEFAULT_SORT) n += 1;
  if (filters.extra && Object.keys(filters.extra).length) n += 1;
  return n;
}

function FilterControls({
  mediaType,
  genreOptions,
  filters,
  update,
  toggleGenre,
}: {
  mediaType: MediaType;
  genreOptions: Genre[];
  filters: FilterState;
  update: (patch: Partial<FilterState>) => void;
  toggleGenre: (id: number) => void;
}) {
  const selectedGenres = genreOptions.filter((g) => filters.genres.includes(g.id));
  const availableGenres = genreOptions.filter((g) => !filters.genres.includes(g.id));

  return (
    <>
      <Section label="Genres" emoji="🎬">
        <Select
          value=""
          options={[
            { label: availableGenres.length ? "Add a genre…" : "All genres selected", value: "" },
            ...availableGenres.map((genre) => ({ label: genre.name, value: genre.id })),
          ]}
          onChange={(value) => {
            const id = Number(value);
            if (id) toggleGenre(id);
          }}
        />
        {selectedGenres.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedGenres.map((genre) => (
              <Chip key={genre.id} label={genre.name} onRemove={() => toggleGenre(genre.id)} />
            ))}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Select
          label="Sort by"
          value={filters.sortBy}
          options={sortOptionsFor(mediaType)}
          onChange={(value) => update({ sortBy: value })}
        />
        <Select
          label="Year from"
          value={filters.yearMin ?? 0}
          options={[{ label: "Any", value: 0 }, ...YEAR_OPTIONS]}
          onChange={(value) => update({ yearMin: Number(value) || undefined })}
        />
        <Select
          label="Year to"
          value={filters.yearMax ?? 0}
          options={[{ label: "Any", value: 0 }, ...YEAR_OPTIONS]}
          onChange={(value) => update({ yearMax: Number(value) || undefined })}
        />
        <Select
          label="Min rating"
          value={filters.minRating ?? 0}
          options={RATING_OPTIONS}
          onChange={(value) => update({ minRating: Number(value) || undefined })}
        />
        <Select
          label="Language"
          value={filters.language ?? ""}
          options={LANGUAGE_OPTIONS}
          onChange={(value) => update({ language: value || undefined })}
        />
      </div>
    </>
  );
}

function FilterChips({
  filters,
  animeOnly,
  genreName,
  update,
  toggleGenre,
}: {
  filters: FilterState;
  animeOnly?: boolean;
  genreName: Map<number, string>;
  update: (patch: Partial<FilterState>) => void;
  toggleGenre: (id: number) => void;
}) {
  const visibleGenres = filters.genres.filter((id) => !(animeOnly && id === 16));
  const extraCount = filters.extra ? Object.keys(filters.extra).length : 0;

  if (!(visibleGenres.length || filters.yearMin || filters.yearMax || filters.minRating || filters.language || extraCount)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visibleGenres.map((id) => (
        <Chip key={id} label={genreName.get(id) ?? `Genre ${id}`} onRemove={() => toggleGenre(id)} />
      ))}
      {(filters.yearMin || filters.yearMax) && (
        <Chip
          label={yearChipLabel(filters.yearMin, filters.yearMax)}
          onRemove={() => update({ yearMin: undefined, yearMax: undefined })}
        />
      )}
      {filters.minRating ? (
        <Chip label={`${filters.minRating}+ rating`} onRemove={() => update({ minRating: undefined })} />
      ) : null}
      {filters.language && (
        <Chip
          label={LANGUAGE_OPTIONS.find((o) => o.value === filters.language)?.label ?? filters.language}
          onRemove={() => update({ language: undefined })}
        />
      )}
      {extraCount > 0 && (
        <Chip label={`+${extraCount} preset filter${extraCount > 1 ? "s" : ""}`} onRemove={() => update({ extra: {} })} />
      )}
    </div>
  );
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
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    // Bottom sheet on mobile, centred dialog on desktop.
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full animate-slide-up flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-surface shadow-2xl shadow-black/50 sm:max-h-[85vh] sm:max-w-2xl sm:animate-pop-in sm:rounded-[28px]">
        {/* Soft accent glow behind the header */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/15 to-transparent" />

        <div className="relative shrink-0 px-5 pb-4 pt-4 sm:px-6">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/15 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary-dark/40">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="leading-tight">
                <h2 className="text-base font-bold sm:text-lg">Filters{activeCount > 0 ? ` · ${activeCount}` : ""}</h2>
                <p className="text-xs text-muted">Find your next watch ✨</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="rounded-full p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 space-y-5 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>

        <div className="flex shrink-0 items-center gap-3 border-t border-white/10 bg-surface px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onReset}
            disabled={!showReset}
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2.5 text-sm font-medium transition-colors",
              showReset ? "text-muted hover:border-white/20 hover:text-white" : "cursor-not-allowed text-muted/40",
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary-dark px-7 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-dark/30 transition-all hover:bg-primary-dark/90 hover:shadow-primary-dark/50 sm:ml-auto sm:flex-none"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Show results
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ label, emoji, children }: { label: string; emoji?: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {emoji && <span className="text-sm">{emoji}</span>}
        {label}
      </span>
      {children}
    </div>
  );
}

function sameParams(a: Record<string, string | number | boolean>, b: Record<string, string | number | boolean>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => String(a[key]) === String(b[key]));
}

function yearChipLabel(min?: number, max?: number): string {
  if (min && max) return `${min}–${max}`;
  if (min) return `From ${min}`;
  return `Until ${max}`;
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-accent">
      {label}
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="text-accent/70 hover:text-white">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
