"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Info, Play, Star } from "lucide-react";
import { getTMDBImageUrl, ANIME_FILTERS } from "@/lib/tmdb/images";
import { getYear, normalizeRating } from "@/lib/utils";
import { MediaType, TimeWindow, getTrendingMoviesQuery, getTrendingTVShowsQuery, type TrendingItem } from "@/lib/tmdb/queries";
import { Spinner } from "@/components/ui/Spinner";

const ANIME_GENRE_IDS = ANIME_FILTERS.with_genres.split(",").map(Number);

interface HeroProps {
  mediaType: MediaType;
  animeOnly?: boolean;
}

export function Hero({ mediaType, animeOnly }: HeroProps) {
  const queryFactory = mediaType === MediaType.movie ? getTrendingMoviesQuery : getTrendingTVShowsQuery;
  const { data, isLoading } = useQuery(queryFactory({ variables: { time_window: TimeWindow.day } }));

  const items = useMemo(() => {
    return (data?.results ?? [])
      .filter((item) => {
        const genres = new Set(item.genre_ids);
        const isAnime = ANIME_GENRE_IDS.some((id) => genres.has(id));
        if (animeOnly) return isAnime;
        if (mediaType === MediaType.movie) return item.media_type === MediaType.movie && !isAnime;
        return item.media_type === MediaType.tv && !isAnime;
      })
      .filter((item) => item.backdrop_path)
      .slice(0, 8);
  }, [data, animeOnly, mediaType]);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 6000, stopOnInteraction: false })]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (isLoading) {
    return (
      <div className="flex h-[42vh] min-h-[320px] items-center justify-center sm:h-[56vh]">
        <Spinner />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="group/hero relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {items.map((item, index) => (
            <HeroSlide key={item.id} item={item} type={mediaType} priority={index === 0} />
          ))}
        </div>
      </div>

      <button
        type="button"
        aria-label="Previous"
        onClick={scrollPrev}
        className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 opacity-0 transition-opacity hover:bg-black/80 group-hover/hero:opacity-100 md:block"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={scrollNext}
        className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 opacity-0 transition-opacity hover:bg-black/80 group-hover/hero:opacity-100 md:block"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}

function HeroSlide({ item, type, priority }: { item: TrendingItem; type: MediaType; priority?: boolean }) {
  const title = item.title || item.name;
  const year = getYear(item.release_date ?? item.first_air_date);
  // w1280 (not original): the optimizer no longer resizes, so cap the source
  // ourselves — sharp on 1080p while avoiding multi-MB backdrops.
  const backdrop = getTMDBImageUrl(item.backdrop_path, "w1280");
  const href = `/media/${type}/${item.id}`;

  return (
    <div className="relative h-[42vh] min-h-[320px] flex-[0_0_100%] sm:h-[56vh]">
      {backdrop && (
        <img
          src={backdrop}
          alt={title}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />

      <div className="absolute inset-0 mx-auto flex max-w-[1600px] flex-col justify-end px-4 pb-10 sm:px-6 lg:px-10 lg:pb-16">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-extrabold drop-shadow-lg sm:text-5xl">{title}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-accent">
            {year && <span>{year}</span>}
            {item.vote_average > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {normalizeRating(item.vote_average)}
              </span>
            )}
          </div>
          <p className="mt-3 line-clamp-3 max-w-xl text-sm text-white/80 sm:text-base">{item.overview}</p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/watch/${type}/${item.id}`}
              className="flex items-center gap-2 rounded-lg bg-primary-dark px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark/90"
            >
              <Play className="h-4 w-4 fill-white" />
              Play<span className="sr-only"> {title}</span>
            </Link>
            <Link
              href={href}
              className="flex items-center gap-2 rounded-lg bg-white/15 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/25"
            >
              <Info className="h-4 w-4" />
              More Info<span className="sr-only"> about {title}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
