"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Info, Play, Star } from "lucide-react";
import { getTMDBImageUrl, ANIME_FILTERS } from "@/lib/tmdb/images";
import { getYear, normalizeRating } from "@/lib/utils";
import { MediaType, TimeWindow, getTrendingMoviesQuery, getTrendingTVShowsQuery, type TrendingItem } from "@/lib/tmdb/queries";
import { Spinner } from "@/components/ui/Spinner";
import { topRanked } from "./rail-items";
import { useClaimItems } from "./shown-titles";

/**
 * What the anime rows ask /discover for, restated for a trending feed that arrives unfiltered.
 *
 * Both halves of ANIME_FILTERS are needed, because it is the pair that means "anime": the genre on
 * its own is TMDB's "Animation", which would read a Pixar or DreamWorks film as anime and so keep it
 * out of the movie hero — and would let one into the anime hero.
 */
const ANIME_GENRE_IDS = ANIME_FILTERS.with_genres.split(",").map(Number);
const ANIME_LANGUAGE = ANIME_FILTERS.with_original_language;

/** Titles the carousel rotates through — and so, exactly, the titles it claims from the rows below. */
const SLIDES = 8;

interface HeroProps {
  mediaType: MediaType;
  animeOnly?: boolean;
  /** The hero's claim on a title two rows drew: lowest `order` keeps it. Not page position — see ./HomeRails.tsx. */
  order: number;
  /**
   * Set when a ranked Top 10 of this same feed runs below the hero. Those ten titles are spoken
   * for — that row's heading is a claim about TMDB's ranking and it can give none of them up — so
   * the carousel features what sits under them. It loses nothing by it: a hero is whatever is worth
   * looking at, with no numbering of its own to falsify.
   */
  rankedBelow?: boolean;
}

export function Hero({ mediaType, animeOnly, order, rankedBelow }: HeroProps) {
  const queryFactory = mediaType === MediaType.movie ? getTrendingMoviesQuery : getTrendingTVShowsQuery;
  const { data, isLoading } = useQuery(queryFactory({ variables: { time_window: TimeWindow.day } }));

  // Taken from the trending response both rows share, rather than from what the Top 10 published:
  // claims arrive in an effect that never runs on the server, and a hero that waited for one would
  // be server-rendered on the ranked ten and then re-shuffled in the browser — see ./rail-items.ts.
  const reserved = useMemo(
    () => new Set(rankedBelow ? topRanked(data?.results ?? []).map((item) => item.id) : []),
    [data, rankedBelow],
  );

  const candidates = useMemo(() => {
    return (data?.results ?? [])
      .filter((item) => !reserved.has(item.id))
      .filter((item) => {
        const genres = new Set(item.genre_ids);
        const isAnime = item.original_language === ANIME_LANGUAGE && ANIME_GENRE_IDS.some((id) => genres.has(id));
        if (animeOnly) return isAnime;
        if (mediaType === MediaType.movie) return item.media_type === MediaType.movie && !isAnime;
        return item.media_type === MediaType.tv && !isAnime;
      })
      .filter((item) => item.backdrop_path);
  }, [data, reserved, animeOnly, mediaType]);

  // The cut to SLIDES happens here, not in the filter above, so what the carousel claims from the
  // rows below it is only what it is actually rotating through. Twenty trending titles less the
  // ranked ten leaves the eight comfortably; a feed short enough to leave fewer shows fewer, and
  // one that leaves none renders no hero at all, which beats printing the row below it twice.
  const items = useMemo(() => candidates.slice(0, SLIDES), [candidates]);
  useClaimItems(order, mediaType, items);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 6000, stopOnInteraction: false })]);
  const heroRef = useRef<HTMLDivElement>(null);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // Dots need to know which slide is showing, and autoplay changes it without
  // us asking — so follow embla's own selection rather than tracking clicks.
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    if (!emblaApi) return;
    const sync = () => setSelected(emblaApi.selectedScrollSnap());
    sync();
    emblaApi.on("select", sync);
    return () => {
      emblaApi.off("select", sync);
    };
  }, [emblaApi]);

  /**
   * Nothing rotates while the viewer is standing on it. On a television the D-pad's opening focus
   * lands on the first slide's Watch now link, and six seconds later autoplay carried that link —
   * ring and all — off the side of the screen, so a viewer who had pressed nothing was left aiming
   * a remote at a control they could no longer see. Embla's own `stopOnFocusIn` does not cover it:
   * that answers `slideFocusStart`, which the core emits only within 10ms of a Tab press (see
   * SlideFocus in embla-carousel), while a D-pad moves focus by calling focus() outright. Rotation
   * picks up again the moment focus leaves the hero, so a pointer visitor — who focuses nothing by
   * hovering or by watching — still gets the carousel that was here before.
   */
  useEffect(() => {
    const hero = heroRef.current;
    const autoplay = emblaApi?.plugins().autoplay;
    if (!hero || !autoplay) return;

    const pause = () => autoplay.stop();
    const resume = (event: FocusEvent) => {
      // focusout fires for a step between two of the hero's own controls as well, and that is
      // still the viewer standing on the hero.
      if (event.relatedTarget instanceof Node && hero.contains(event.relatedTarget)) return;
      autoplay.play();
    };
    // A mouse leaves focus parked on the arrow it clicked while the viewer's attention has already
    // moved on, which is nobody standing on anything — so releasing the button hands the timer
    // back, and a pointer visitor keeps the carousel they had before. It is not a release a remote
    // can send: Enter on a focused control raises a click and no mouse event at all.
    const release = () => autoplay.play();

    // Focus can already be inside by the time embla hands back its API.
    if (hero.contains(document.activeElement)) pause();
    hero.addEventListener("focusin", pause);
    hero.addEventListener("focusout", resume);
    hero.addEventListener("mouseup", release);
    return () => {
      hero.removeEventListener("focusin", pause);
      hero.removeEventListener("focusout", resume);
      hero.removeEventListener("mouseup", release);
    };
  }, [emblaApi]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] min-h-[420px] items-center justify-center sm:h-[76vh]">
        <Spinner />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div ref={heroRef} className="group/hero relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {items.map((item, index) => (
            <HeroSlide key={item.id} item={item} type={mediaType} priority={index === 0} onScreen={index === selected} />
          ))}
        </div>
      </div>

      {/* Hovering is what reveals these to a pointer, and a remote cannot hover — so focus reveals
          them too: a ring around something painted at zero opacity is a ring the viewer has lost.
          The pinning lives on the wrapper rather than the button because the TV focus ring sets
          `position: relative` on whatever it lands on (see html.tv in globals.css), which on the
          button itself outranked `absolute` and dropped it back into the flow — the arrow leapt to
          the foot of the hero and made the hero 50px taller for as long as it was focused. */}
      <div className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 md:block">
        <button
          type="button"
          aria-label="Previous"
          onClick={scrollPrev}
          className="rounded-full bg-black/50 p-2 opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover/hero:opacity-100"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      </div>
      <div className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 md:block">
        <button
          type="button"
          aria-label="Next"
          onClick={scrollNext}
          className="rounded-full bg-black/50 p-2 opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover/hero:opacity-100"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Dots sit over the fade at the bottom of the artwork: on a page that
          rotates by itself, they are what tells you it rotates at all. */}
      {items.length > 1 && (
        <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center gap-1.5">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === selected}
              onClick={() => emblaApi?.scrollTo(index)}
              className={
                index === selected
                  ? "h-1.5 w-5 rounded-full bg-white transition-all"
                  : "h-1.5 w-1.5 rounded-full bg-white/35 transition-all hover:bg-white/60"
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HeroSlide({
  item,
  type,
  priority,
  onScreen,
}: {
  item: TrendingItem;
  type: MediaType;
  priority?: boolean;
  onScreen: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const title = item.title || item.name;
  const year = getYear(item.release_date ?? item.first_air_date);
  // w1280 (not original): the optimizer no longer resizes, so cap the source
  // ourselves — sharp on 1080p while avoiding multi-MB backdrops.
  const backdrop = getTMDBImageUrl(item.backdrop_path, "w1280");
  const href = `/media/${type}/${item.id}`;

  /**
   * Only the slide on screen may be landed on. The seven behind it are one transform away from the
   * viewport with their links still in the document and still focusable, so the D-pad's geometry
   * search would step sideways onto a link a screen's width away — carrying the ring off the
   * television exactly as autoplay used to — and Tab did the same to a keyboard. `inert` is set
   * from an effect because React 18 has no prop for it; lib/tv/spatial-nav.ts reads the attribute
   * itself, so the seal holds on the TV browsers that are too old to implement it.
   */
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (onScreen) node.removeAttribute("inert");
    else node.setAttribute("inert", "");
  }, [onScreen]);

  return (
    // Labelled as a group rather than headed: a slide title is the artwork's caption, not a section
    // heading, and eight of them would bury the page's own heading in a screen reader's outline.
    <div ref={ref} role="group" aria-label={title} className="relative h-[60vh] min-h-[420px] flex-[0_0_100%] sm:h-[76vh]">
      {backdrop && (
        <img
          src={backdrop}
          alt={title}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />

      <div className="absolute inset-0 mx-auto flex max-w-[1600px] flex-col justify-end px-4 pb-10 sm:px-6 lg:px-10 lg:pb-16">
        <div className="max-w-2xl">
          <p className="text-4xl font-extrabold tracking-tight drop-shadow-lg sm:text-6xl">{title}</p>
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
              className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
            >
              <Play className="h-4 w-4 fill-black" />
              Watch now<span className="sr-only"> {title}</span>
            </Link>
            <Link
              href={href}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xl transition-colors hover:bg-white/20"
            >
              <Info className="h-4 w-4" />
              More info<span className="sr-only"> about {title}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
