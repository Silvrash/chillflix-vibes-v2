"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { getYear, normalizeRating } from "@/lib/utils";
import type { Cast, Crew, Movie, TVShow } from "@/lib/tmdb/queries";
import { HoverPreview } from "./HoverPreview";

type MediaCardItem = Movie | TVShow | Cast | Crew;

function isPerson(item: MediaCardItem): item is Cast | Crew {
  return "character" in item || "job" in item;
}

export function MediaCard({ item }: { item: MediaCardItem }) {
  const router = useRouter();
  const person = isPerson(item);
  const title = "title" in item ? item.title : item.name;
  const posterPath = "poster_path" in item ? item.poster_path : item.profile_path;
  const poster = getTMDBImageUrl(posterPath, "w342");

  const year = "release_date" in item ? getYear(item.release_date) : "first_air_date" in item ? getYear(item.first_air_date) : "";
  const rating = "vote_average" in item ? item.vote_average : undefined;
  const subtitle = "character" in item ? item.character : "job" in item ? item.job : "";

  const card = (
    <div className="group relative">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface-light ring-1 ring-white/5 transition-transform duration-200 group-hover:scale-[1.03] group-hover:ring-primary/50">
        {poster ? (
          <img src={poster} alt={title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted">{title}</div>
        )}

        {!person && rating !== undefined && rating > 0 && (
          <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {normalizeRating(rating)}
          </div>
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-center text-sm font-medium text-accent">
        {title}
        {year ? ` (${year})` : ""}
      </p>
      {person && subtitle ? <p className="line-clamp-1 text-center text-xs text-muted">{subtitle}</p> : null}
    </div>
  );

  if (person) return card;

  const type = "title" in item ? "movie" : "tv";
  const href = `/media/${type}/${item.id}`;
  return (
    <HoverPreview item={item}>
      <Link
        href={href}
        prefetch={false}
        onMouseEnter={() => router.prefetch(href)}
        onFocus={() => router.prefetch(href)}
        className="block"
      >
        {card}
      </Link>
    </HoverPreview>
  );
}
