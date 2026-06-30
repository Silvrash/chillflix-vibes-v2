"use client";

import { Spinner } from "@/components/ui/Spinner";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { useMediaTypeQueries } from "@/lib/tmdb/media-queries";
import {
  MediaType,
  getMovieCreditsQuery,
  getTVCreditsQuery,
  type Cast,
  type Crew,
  type Movie,
  type TVShow,
  type Video,
} from "@/lib/tmdb/queries";
import { cn, formatDate, normalizeRating } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, ChevronDown, Clock, Play, Star, X, Youtube } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MediaRail } from "./MediaRail";

export function MediaDetail({ id, type }: { id: number; type: MediaType }) {
  const { query, recommendedQuery, similarQuery } = useMediaTypeQueries(id, type);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [castOpen, setCastOpen] = useState(false);
  const [crewOpen, setCrewOpen] = useState(false);

  // Cast/crew are fetched lazily — only once a section is expanded — so they
  // don't slow the initial page load. One endpoint backs both sections.
  const isMovie = type === MediaType.movie;
  const creditsEnabled = castOpen || crewOpen;
  const movieCredits = useQuery(getMovieCreditsQuery({ enabled: creditsEnabled && isMovie, variables: { movie_id: id } }));
  const tvCredits = useQuery(getTVCreditsQuery({ enabled: creditsEnabled && !isMovie, variables: { series_id: id } }));
  const creditsQuery = isMovie ? movieCredits : tvCredits;

  if (query.isLoading || !query.data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        {query.isError ? <p className="text-muted">Failed to load. Please try again.</p> : <Spinner />}
      </div>
    );
  }

  const data = query.data;
  const title = "title" in data ? data.title : data.name;
  const releaseDate = "release_date" in data ? data.release_date : data.first_air_date;
  const runtime = "runtime" in data ? data.runtime : data.episode_run_time?.[0];
  const runtimeLabel = "runtime" in data ? "Runtime" : "Episode Runtime";
  const totalSeasons = "number_of_seasons" in data ? data.number_of_seasons : null;
  const totalEpisodes = "number_of_episodes" in data ? data.number_of_episodes : null;
  // Decorative backdrop (gradient + poster overlaid) — w1280 transcodes ~3.6x
  // faster than `original` with no visible quality loss, so the hero loads quickly.
  const backdrop = getTMDBImageUrl(data.backdrop_path, "w1280");
  // w780 (not w342): the poster renders ~240px wide, which is ~480–720px on
  // hi-DPI screens, so a larger source keeps it crisp instead of upscaled.
  const poster = getTMDBImageUrl(data.poster_path, "w780");

  const recommended = ((recommendedQuery.data?.pages ?? []) as any[]).flatMap((page) => page.results) as (Movie | TVShow)[];
  const similar = ((similarQuery.data?.pages ?? []) as any[]).flatMap((page) => page.results) as (Movie | TVShow)[];

  const trailer = pickTrailer(data.videos?.results);

  return (
    <div className="pb-16">
      {/* Backdrop hero */}
      <div className="relative h-[40vh] min-h-[300px] w-full sm:h-[55vh]">
        {backdrop && <Image src={backdrop} alt={title} fill priority quality={78} className="object-cover" sizes="100vw" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        <Link
          href={type === MediaType.movie ? "/movies" : "/tv"}
          className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-sm backdrop-blur transition-colors hover:bg-black/80 sm:left-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="mx-auto -mt-28 max-w-[1600px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="relative z-10 mx-auto aspect-[2/3] w-44 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10 sm:mx-0 sm:w-80">
            {poster ? (
              <Image src={poster} alt={title} fill className="object-cover" sizes="240px" />
            ) : (
              <div className="flex h-full items-center justify-center bg-surface-light text-center text-sm text-muted">
                {title}
              </div>
            )}
          </div>

          <div className="flex-1 pt-2 sm:pt-28">
            <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-accent">
              {data.vote_average > 0 && (
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {normalizeRating(data.vote_average)}
                </span>
              )}
              {releaseDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatDate(releaseDate)}
                </span>
              )}
              {runtime ? (
                <span className="flex items-center gap-1.5" title={runtimeLabel}>
                  <Clock className="h-4 w-4" />
                  {runtime} min
                </span>
              ) : null}
            </div>

            {"genres" in data && data.genres?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.genres.map((genre) => (
                  <span key={genre.id} className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                    {genre.name}
                  </span>
                ))}
              </div>
            )}

            {(totalSeasons || totalEpisodes) && (
              <p className="mt-3 text-sm text-muted">
                {totalSeasons} {totalSeasons === 1 ? "Season" : "Seasons"} · {totalEpisodes} Episodes
              </p>
            )}

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/80 sm:text-base">{data.overview}</p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link
                href={`/watch/${type}/${id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-dark px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark/90"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                Play Now
              </Link>
              {trailer && (
                <button
                  type="button"
                  onClick={() => setTrailerOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  <Youtube className="h-3.5 w-3.5" />
                  Trailer
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 space-y-10">
          {recommended.length > 0 && (
            <MediaRail title="Recommended" items={recommended} onEndReached={() => recommendedQuery.fetchNextPage()} />
          )}
          {similar.length > 0 && <MediaRail title="Similar" items={similar} onEndReached={() => similarQuery.fetchNextPage()} />}

          <div className="space-y-6">
            <CreditsSection
              title="Cast"
              open={castOpen}
              onToggle={() => setCastOpen((value) => !value)}
              loading={castOpen && creditsQuery.isLoading}
              items={creditsQuery.data?.cast ?? []}
              emptyLabel="No cast information available."
            />
            <CreditsSection
              title="Crew"
              open={crewOpen}
              onToggle={() => setCrewOpen((value) => !value)}
              loading={crewOpen && creditsQuery.isLoading}
              items={creditsQuery.data?.crew ?? []}
              emptyLabel="No crew information available."
            />
          </div>
        </div>
      </div>

      {trailer && trailerOpen && <TrailerModal videoKey={trailer.key} title={title} onClose={() => setTrailerOpen(false)} />}
    </div>
  );
}

/** Collapsible cast/crew rail. Its data is only fetched once `open` is true. */
function CreditsSection({
  title,
  open,
  loading,
  onToggle,
  items,
  emptyLabel,
}: {
  title: string;
  open: boolean;
  loading: boolean;
  onToggle: () => void;
  items: (Cast | Crew)[];
  emptyLabel: string;
}) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 border-b border-white/10 pb-2 text-left transition-colors hover:border-white/25"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-xl font-bold">{title}</span>
          {open && !loading && items.length > 0 && <span className="text-sm font-normal text-muted">{items.length}</span>}
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : items.length > 0 ? (
            <MediaRail items={items} />
          ) : (
            <p className="py-4 text-sm text-muted">{emptyLabel}</p>
          )}
        </div>
      )}
    </section>
  );
}

/** Pick the best playable trailer: an official YouTube trailer, else any trailer/teaser. */
function pickTrailer(videos?: Video[]): Video | undefined {
  const youtube = (videos ?? []).filter((v) => v.site === "YouTube" && v.key);
  return (
    youtube.find((v) => v.type === "Trailer" && /official/i.test(v.name)) ??
    youtube.find((v) => v.type === "Trailer") ??
    youtube.find((v) => v.type === "Teaser") ??
    youtube[0]
  );
}

function TrailerModal({ videoKey, title, onClose }: { videoKey: string; title: string; onClose: () => void }) {
  useEffect(() => {
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
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-4xl animate-pop-in">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close trailer"
          className="absolute -top-9 right-0 flex items-center gap-1 text-sm font-medium text-white/80 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
          Close
        </button>
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
          <iframe
            src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0`}
            title={`${title} — Trailer`}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
