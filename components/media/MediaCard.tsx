"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { cn, getYear, normalizeRating } from "@/lib/utils";
import { MediaType, type Cast, type Crew, type Movie, type TrendingItem, type TVShow } from "@/lib/tmdb/queries";
import { HoverPreview } from "./HoverPreview";

export type MediaCardItem = Movie | TVShow | TrendingItem | Cast | Crew;
export type MediaCardVariant = "portrait" | "landscape";

export interface MediaCardProps {
  item: MediaCardItem;
  /** Portrait is the poster shape used by grids and most rails; landscape uses the backdrop with the title laid over it. */
  variant?: MediaCardVariant;
  /** Overrides the /media/[type]/[id] target for payloads whose shape does not say which one they are. */
  mediaType?: MediaType;
  /** Above-the-fold artwork loads eagerly. */
  priority?: boolean;
  className?: string;
}

function isPerson(item: MediaCardItem): item is Cast | Crew {
  return "character" in item || "job" in item;
}

function resolveMediaType(item: MediaCardItem, override?: MediaType): MediaType {
  if (override) return override;
  // Mixed trending payloads name their own type, and a film and a series can share an id — without this a show links to a movie.
  if ("media_type" in item && item.media_type) return item.media_type;
  return "title" in item ? MediaType.movie : MediaType.tv;
}

export function MediaCard({ item, variant = "portrait", mediaType, priority = false, className }: MediaCardProps) {
  const router = useRouter();
  const person = isPerson(item);
  // A headshot has no backdrop, and a 16:9 crop of one is unusable, so people are always posters.
  const shape = person ? "portrait" : variant;

  const title = "title" in item && item.title ? item.title : "name" in item ? item.name : "";
  const poster = getTMDBImageUrl("poster_path" in item ? item.poster_path : item.profile_path, "w342");
  const backdrop = "backdrop_path" in item ? getTMDBImageUrl(item.backdrop_path, "w780") : "";
  // A poster cropped to 16:9 loses most of the frame, but an empty card loses all of it.
  const artwork = shape === "landscape" ? backdrop || poster : poster;

  const year = getYear("release_date" in item ? item.release_date : "first_air_date" in item ? item.first_air_date : undefined);
  const rating = "vote_average" in item ? item.vote_average : undefined;

  const type = resolveMediaType(item, mediaType);
  const role = "character" in item ? item.character : "job" in item ? item.job : "";
  const meta = person ? role : [year, type === MediaType.movie ? "Movie" : "TV"].filter(Boolean).join(" · ");

  const card = (
    <div className={cn("group relative", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl bg-surface-light ring-1 ring-white/10",
          "transition duration-200 group-hover:scale-[1.03] group-hover:ring-white/25",
          "group-focus-visible:scale-[1.03] group-focus-visible:ring-white/25",
          // Literal aspect classes: globals.css carries a padding-top fallback keyed on these exact
          // names for TV browsers older than aspect-ratio, and a fresh one would get no fallback.
          shape === "landscape" ? "aspect-video" : "aspect-[2/3]",
        )}
      >
        {artwork ? (
          <img
            src={artwork}
            alt={title}
            loading={priority ? "eager" : "lazy"}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-muted">{title}</div>
        )}

        {shape === "landscape" && (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="line-clamp-1 text-sm font-semibold text-white">{title}</p>
              {meta && <p className="mt-0.5 line-clamp-1 text-xs text-white/70">{meta}</p>}
            </div>
          </>
        )}

        {!person && rating !== undefined && rating > 0 && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {normalizeRating(rating)}
          </span>
        )}
      </div>

      {shape === "portrait" && (
        <>
          <p className="mt-2.5 line-clamp-1 text-sm font-medium text-white">{title}</p>
          {meta && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{meta}</p>}
        </>
      )}
    </div>
  );

  if (person) return card;

  const href = `/media/${type}/${item.id}`;
  return (
    // HoverPreview is typed for Movie | TVShow, but it only reads fields TrendingItem also carries.
    <HoverPreview item={item as unknown as Movie | TVShow}>
      <Link
        href={href}
        prefetch={false}
        onMouseEnter={() => router.prefetch(href)}
        onFocus={() => router.prefetch(href)}
        // The link wraps the card, so it carries `group` too — focus lands here, not on the card.
        className="group block rounded-xl focus-visible:outline-none"
      >
        {card}
      </Link>
    </HoverPreview>
  );
}
