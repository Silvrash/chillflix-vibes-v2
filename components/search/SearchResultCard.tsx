"use client";

import Link from "next/link";
import { Star, User } from "lucide-react";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { normalizeRating } from "@/lib/utils";
import type { SearchResult } from "./search-queries";

export interface SearchResultCardProps {
  result: SearchResult;
  /** Lets the overlay close itself the moment a result is chosen, before the route settles. */
  onNavigate: () => void;
}

/**
 * Deliberately not MediaCard: that one wraps every poster in a HoverPreview, which portals to
 * <body> at z-[100] and would float a second card on top of this dialog.
 */
export function SearchResultCard({ result, onNavigate }: SearchResultCardProps) {
  const artwork = getTMDBImageUrl(result.imagePath, "w342");

  const card = (
    <div className="group">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface-light ring-1 ring-white/10 transition duration-200 group-hover:scale-[1.03] group-hover:ring-white/25 group-focus-visible:scale-[1.03] group-focus-visible:ring-white/25">
        {artwork ? (
          <img src={artwork} alt={result.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-muted">
            {/* A name in an empty headshot box only repeats the one printed under the card; a title
                in an empty poster is the whole card. */}
            {result.kind === "person" ? <User className="h-6 w-6" /> : <span className="line-clamp-3">{result.title}</span>}
          </div>
        )}

        {result.kind !== "person" && result.rating > 0 && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {normalizeRating(result.rating)}
          </span>
        )}
      </div>

      <p className="mt-2.5 line-clamp-1 text-sm font-medium text-white">{result.title}</p>
      {result.subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{result.subtitle}</p>}
    </div>
  );

  if (!result.detailHref) return card;

  return (
    <Link
      href={result.detailHref}
      prefetch={false}
      onClick={onNavigate}
      className="group block rounded-xl focus-visible:outline-none"
    >
      {card}
    </Link>
  );
}
