"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, RotateCcw, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { PresetSelect } from "./PresetSelect";
import { cn } from "@/lib/utils";
import { MediaType } from "@/lib/tmdb/queries";
import type { Preset } from "@/lib/presets";
import {
  type FilterState,
  LANGUAGE_OPTIONS,
  RATING_OPTIONS,
  YEAR_OPTIONS,
  emptyFilters,
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
  const [presetLabel, setPresetLabel] = useState(presets[0]?.name ?? CUSTOM_LABEL);

  // Genre 16 (Animation) is always applied on the anime page, so hide it from the picker.
  const genreOptions = useMemo(() => (animeOnly ? genres.filter((g) => g.id !== 16) : genres), [genres, animeOnly]);
  const genreName = useMemo(() => new Map(genres.map((g) => [g.id, g.name])), [genres]);

  function apply(next: FilterState, fromPreset?: string) {
    setPresetLabel(fromPreset ?? CUSTOM_LABEL);
    onChange(next);
  }

  const update = (patch: Partial<FilterState>) => apply({ ...filters, ...patch });

  function selectPreset(name: string) {
    const preset = presets.find((p) => p.name === name);
    if (preset) apply(presetToFilterState(preset), name);
  }

  function toggleGenre(id: number) {
    const has = filters.genres.includes(id);
    update({ genres: has ? filters.genres.filter((g) => g !== id) : [...filters.genres, id] });
  }

  const showReset = hasActiveFilters(filters, animeOnly);
  const visibleGenres = filters.genres.filter((id) => !(animeOnly && id === 16));
  const extraCount = filters.extra ? Object.keys(filters.extra).length : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex w-full max-w-xs flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Quick picks</span>
          <PresetSelect options={presets.map((p) => p.name)} value={presetLabel} onChange={selectPreset} />
        </label>

        {showReset && (
          <button
            type="button"
            onClick={() => apply(emptyFilters())}
            className="flex items-center gap-1.5 self-start rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:border-white/20 hover:text-white sm:self-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="w-full sm:w-52">
          <GenreSelect genres={genreOptions} selected={filters.genres} genreName={genreName} onToggle={toggleGenre} />
        </div>
        <div className="w-full sm:w-44">
          <Select
            label="Sort by"
            value={filters.sortBy}
            options={sortOptionsFor(mediaType)}
            onChange={(value) => update({ sortBy: value })}
          />
        </div>
        <div className="w-full sm:w-32">
          <Select
            label="Year from"
            value={filters.yearMin ?? 0}
            options={[{ label: "Any", value: 0 }, ...YEAR_OPTIONS]}
            onChange={(value) => update({ yearMin: Number(value) || undefined })}
          />
        </div>
        <div className="w-full sm:w-32">
          <Select
            label="Year to"
            value={filters.yearMax ?? 0}
            options={[{ label: "Any", value: 0 }, ...YEAR_OPTIONS]}
            onChange={(value) => update({ yearMax: Number(value) || undefined })}
          />
        </div>
        <div className="w-full sm:w-36">
          <Select
            label="Min rating"
            value={filters.minRating ?? 0}
            options={RATING_OPTIONS}
            onChange={(value) => update({ minRating: Number(value) || undefined })}
          />
        </div>
        <div className="w-full sm:w-40">
          <Select
            label="Language"
            value={filters.language ?? ""}
            options={LANGUAGE_OPTIONS}
            onChange={(value) => update({ language: value || undefined })}
          />
        </div>
      </div>

      {(visibleGenres.length > 0 ||
        filters.yearMin ||
        filters.yearMax ||
        filters.minRating ||
        filters.language ||
        extraCount > 0) && (
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
      )}
    </div>
  );
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

function GenreSelect({
  genres,
  selected,
  genreName,
  onToggle,
}: {
  genres: Genre[];
  selected: number[];
  genreName: Map<number, string>;
  onToggle: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const count = selected.filter((id) => genreName.has(id)).length;
  const filtered = genres.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <label className="flex w-full flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">Genres</span>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-left text-sm font-medium transition-colors hover:border-white/20"
        >
          <span className="truncate">{count ? `${count} selected` : "All genres"}</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute z-30 mt-2 w-full min-w-[14rem] overflow-hidden rounded-lg border border-white/10 bg-surface shadow-xl">
            <div className="border-b border-white/10 p-2">
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a genre"
                className="w-full rounded-md bg-surface-light px-3 py-1.5 text-sm outline-none placeholder:text-muted"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {filtered.length === 0 && <li className="px-4 py-2 text-sm text-muted">No genres</li>}
              {filtered.map((genre) => {
                const active = selected.includes(genre.id);
                return (
                  <li key={genre.id}>
                    <button
                      type="button"
                      onClick={() => onToggle(genre.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-white/5",
                        active ? "font-semibold text-white" : "text-muted",
                      )}
                    >
                      <span className="truncate">{genre.name}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </label>
  );
}
