"use client";

import Link from "next/link";
import { Info, Play, Star, User } from "lucide-react";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { normalizeRating } from "@/lib/utils";
import { KIND_LABEL, type SearchResult } from "./search-queries";

export interface TopResultCardProps {
  result: SearchResult;
  onNavigate: () => void;
}

export function TopResultCard({ result, onNavigate }: TopResultCardProps) {
  // A poster cropped to 16:9 loses most of the frame, but it beats an empty panel.
  const artwork = result.backdropPath ? getTMDBImageUrl(result.backdropPath, "w780") : getTMDBImageUrl(result.imagePath, "w780");

  const meta = [result.year, KIND_LABEL[result.kind], result.genres.join(", ")].filter(Boolean).join(" · ");

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl sm:flex sm:items-start">
      {/* The width lives on this wrapper and the 16:9 box is a plain block inside it. Old TV
          browsers fall back to `padding-top: 56.25%` (globals.css), and a percentage padding on
          a flex item resolves against the FLEX CONTAINER's width — on the 46% column that made
          the backdrop roughly twice as tall as the whole card. As a block child it resolves
          against the wrapper, which is the width it is actually drawn at. */}
      <div className="w-full shrink-0 sm:w-[46%]">
        <div className="relative aspect-video w-full bg-surface-light">
          {artwork ? (
            <img src={artwork} alt={result.title} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted">
              <User className="h-8 w-8" />
            </div>
          )}
        </div>
      </div>

      <div className="p-4 sm:flex-1 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Top result</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{result.title}</h2>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-accent">
          {meta && <span>{meta}</span>}
          {result.rating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {normalizeRating(result.rating)}
            </span>
          )}
        </div>

        {result.overview && <p className="mt-3 line-clamp-3 text-sm text-white/70">{result.overview}</p>}

        {(result.watchHref || result.detailHref) && (
          <div className="mt-5 flex flex-wrap gap-3">
            {result.watchHref && (
              <Link
                href={result.watchHref}
                prefetch={false}
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
              >
                <Play className="h-4 w-4 fill-black" />
                Play<span className="sr-only"> {result.title}</span>
              </Link>
            )}
            {result.detailHref && (
              <Link
                href={result.detailHref}
                prefetch={false}
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xl transition-colors hover:bg-white/20"
              >
                <Info className="h-4 w-4" />
                Details<span className="sr-only"> about {result.title}</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
