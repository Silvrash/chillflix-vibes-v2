"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock, Play, Star } from "lucide-react";
import { Player } from "./Player";
import { MediaRail } from "@/components/media/MediaRail";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { STREAM_SERVERS } from "@/lib/streaming/vidsrc";
import { getLastWatched, setLastWatched } from "@/lib/storage";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { cn, getYear, normalizeRating, pad2 } from "@/lib/utils";
import {
  MediaType,
  getMovieDetailsQuery,
  getMovieRecommendationsInfiniteQuery,
  getSeasonDetailsQuery,
  getTVDetailsQuery,
  getTVRecommendationsInfiniteQuery,
  type Episode,
  type Genre,
  type Movie,
  type TVShow,
} from "@/lib/tmdb/queries";

interface WatchViewProps {
  id: number;
  type: MediaType;
  initialSeason: number;
  initialEpisode: number;
}

export function WatchView({ id, type, initialSeason, initialEpisode }: WatchViewProps) {
  const isTv = type === MediaType.tv;
  const [serverIndex, setServerIndex] = useState(0);
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [pendingEpisode, setPendingEpisode] = useState<number | "last" | null>(null);

  // Restore the last-watched season/episode from localStorage on mount.
  useEffect(() => {
    if (!isTv) return;
    const last = getLastWatched(type, id);
    if (last.season) setSeason(last.season);
    if (last.episode) setEpisode(last.episode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isTv) setLastWatched(type, id, season, episode);
  }, [isTv, type, id, season, episode]);

  const movie = useQuery(getMovieDetailsQuery({ enabled: !isTv, variables: { movie_id: id } }));
  const tv = useQuery(getTVDetailsQuery({ enabled: isTv, variables: { tv_id: id } }));
  const seasonDetails = useQuery(getSeasonDetailsQuery({ enabled: isTv, variables: { tv_id: id, season_number: season } }));
  // Infinite variants so this shares the SAME cache shape as the detail page's
  // recommendation rails (same query key) — mixing a plain + infinite query on
  // one key corrupts the cache and crashes on back-navigation.
  const movieRecs = useInfiniteQuery(
    getMovieRecommendationsInfiniteQuery({
      enabled: !isTv,
      variables: { movie_id: id },
      initialPageParam: 1,
      getNextPageParam: (lastPage) => (lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined),
    }),
  );
  const tvRecs = useInfiniteQuery(
    getTVRecommendationsInfiniteQuery({
      enabled: isTv,
      variables: { series_id: id },
      initialPageParam: 1,
      getNextPageParam: (lastPage) => (lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined),
    }),
  );

  const title = isTv ? tv.data?.name : movie.data?.title;
  const overview = isTv ? tv.data?.overview : movie.data?.overview;
  const year = getYear(isTv ? tv.data?.first_air_date : movie.data?.release_date);
  const rating = isTv ? tv.data?.vote_average : movie.data?.vote_average;
  const runtime = isTv ? tv.data?.episode_run_time?.[0] : movie.data?.runtime;
  const genres = (isTv ? tv.data?.genres : movie.data?.genres) ?? [];
  const totalSeasons = tv.data?.number_of_seasons ?? 0;

  const episodes = seasonDetails.data?.episodes ?? [];
  const currentEpisode = episodes.find((ep) => ep.episode_number === episode);
  const lastEpisodeNumber = episodes.length > 0 ? episodes[episodes.length - 1].episode_number : 1;
  const atFirstEpisode = season <= 1 && episode <= 1;
  const atLastEpisode = totalSeasons > 0 && season >= totalSeasons && episodes.length > 0 && episode >= lastEpisodeNumber;

  // Stepping back across a season boundary lands on that season's last episode once it loads.
  useEffect(() => {
    if (pendingEpisode === null || seasonDetails.isLoading) return;
    const eps = seasonDetails.data?.episodes ?? [];
    if (eps.length === 0) return;
    setEpisode(pendingEpisode === "last" ? eps[eps.length - 1].episode_number : pendingEpisode);
    setPendingEpisode(null);
  }, [pendingEpisode, seasonDetails.isLoading, seasonDetails.data]);

  function goToPreviousEpisode() {
    if (episode > 1) {
      setEpisode(episode - 1);
    } else if (season > 1) {
      setSeason(season - 1);
      setPendingEpisode("last");
    }
  }

  function goToNextEpisode() {
    if (episodes.length > 0 && episode < lastEpisodeNumber) {
      setEpisode(episode + 1);
    } else if (totalSeasons > 0 && season < totalSeasons) {
      setSeason(season + 1);
      setEpisode(1);
    }
  }

  const server = STREAM_SERVERS[serverIndex];
  const src = useMemo(
    () => (isTv ? server.getEpisodeLink(id, season, episode) : server.getMovieLink(id)),
    [isTv, server, id, season, episode],
  );

  const recs = (((isTv ? tvRecs.data : movieRecs.data)?.pages ?? []) as { results: (Movie | TVShow)[] }[]).flatMap(
    (page) => page.results,
  );

  return (
    <div className="mx-auto max-w-[1700px] px-4 py-6 sm:px-6 lg:px-10">
      <Link
        href={`/media/${type}/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to details
      </Link>

      <div className={cn("grid gap-6", isTv && "lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]")}>
        {/* Main column: player + controls + info. For movies it fills the width
            but is capped by viewport height so the 16:9 player never overflows. */}
        <div className={cn("min-w-0", !isTv && "mx-auto w-full max-w-[calc(72vh*16/9)]")}>
          <Player src={src} title={title} />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <ServerTabs value={serverIndex} onChange={setServerIndex} />
            {isTv && (
              <div className="flex items-center gap-2">
                <EpisodeNavButton direction="prev" disabled={atFirstEpisode} onClick={goToPreviousEpisode} />
                <span className="min-w-[72px] text-center text-sm font-semibold text-accent">
                  S{pad2(season)} · E{pad2(episode)}
                </span>
                <EpisodeNavButton direction="next" disabled={atLastEpisode} onClick={goToNextEpisode} />
              </div>
            )}
          </div>

          <h1 className="mt-5 text-2xl font-bold sm:text-3xl">{title ?? "Loading…"}</h1>
          <MetaRow year={year} rating={rating} runtime={runtime} genres={genres} totalSeasons={isTv ? totalSeasons : 0} />

          {isTv && currentEpisode && (
            <div className="mt-4 rounded-xl border border-white/5 bg-surface/50 p-4">
              <h2 className="text-base font-semibold">
                E{currentEpisode.episode_number} · {currentEpisode.name}
              </h2>
              {currentEpisode.overview && (
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{currentEpisode.overview}</p>
              )}
            </div>
          )}

          {overview && <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/70">{overview}</p>}
        </div>

        {/* Episodes sidebar (TV only) */}
        {isTv && (
          <aside className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Episodes</h2>
              {totalSeasons > 1 ? (
                <div className="w-40 shrink-0">
                  <Select
                    value={season}
                    options={Array.from({ length: totalSeasons }, (_, i) => ({ label: `Season ${i + 1}`, value: i + 1 }))}
                    onChange={(value) => {
                      setSeason(parseInt(value, 10));
                      setEpisode(1);
                    }}
                  />
                </div>
              ) : (
                episodes.length > 0 && <span className="text-xs text-muted">{episodes.length} episodes</span>
              )}
            </div>
            <EpisodeList episodes={episodes} loading={seasonDetails.isLoading} current={episode} onSelect={setEpisode} />
          </aside>
        )}
      </div>

      {recs.length > 0 && (
        <div className="mt-12">
          <MediaRail title="More Like This" items={recs} />
        </div>
      )}
    </div>
  );
}

function ServerTabs({ value, onChange }: { value: number; onChange: (index: number) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-surface p-1">
      {STREAM_SERVERS.map((srv, index) => (
        <button
          key={srv.name}
          type="button"
          onClick={() => onChange(index)}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            index === value ? "bg-primary-dark text-white" : "text-muted hover:text-white",
          )}
        >
          {srv.name}
        </button>
      ))}
    </div>
  );
}

function MetaRow({
  year,
  rating,
  runtime,
  genres,
  totalSeasons,
}: {
  year?: string;
  rating?: number;
  runtime?: number;
  genres: Genre[];
  totalSeasons: number;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-accent">
      {rating !== undefined && rating > 0 && (
        <span className="flex items-center gap-1 font-semibold">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          {normalizeRating(rating)}
        </span>
      )}
      {year && (
        <span className="flex items-center gap-1">
          <CalendarDays className="h-4 w-4" />
          {year}
        </span>
      )}
      {runtime ? (
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {runtime} min
        </span>
      ) : null}
      {totalSeasons > 0 && (
        <span>
          {totalSeasons} Season{totalSeasons > 1 ? "s" : ""}
        </span>
      )}
      {genres.length > 0 && (
        <span className="text-muted">
          {genres
            .slice(0, 3)
            .map((g) => g.name)
            .join(" · ")}
        </span>
      )}
    </div>
  );
}

function EpisodeNavButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrev ? "Previous episode" : "Next episode"}
      className={cn(
        "flex items-center gap-1 rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-sm font-medium transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "text-muted hover:border-white/20 hover:text-white",
      )}
    >
      {isPrev && <ChevronLeft className="h-4 w-4" />}
      <span className="hidden sm:inline">{isPrev ? "Prev" : "Next"}</span>
      {!isPrev && <ChevronRight className="h-4 w-4" />}
    </button>
  );
}

function EpisodeList({
  episodes,
  loading,
  current,
  onSelect,
}: {
  episodes: Episode[];
  loading: boolean;
  current: number;
  onSelect: (episode: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the active episode in view, but only scroll the list container (never the page).
  useEffect(() => {
    const list = listRef.current;
    const item = activeRef.current;
    if (!list || !item || list.scrollHeight <= list.clientHeight) return;
    const delta = item.getBoundingClientRect().top - list.getBoundingClientRect().top - 8;
    list.scrollTop += delta;
  }, [current, episodes.length]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (episodes.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">No episodes found for this season.</p>;
  }

  return (
    <div ref={listRef} className="space-y-2 lg:max-h-[68vh] lg:overflow-y-auto lg:pr-1">
      {episodes.map((ep) => {
        const active = ep.episode_number === current;
        const still = getTMDBImageUrl(ep.still_path, "w300");
        return (
          <button
            key={ep.id}
            ref={active ? activeRef : undefined}
            type="button"
            onClick={() => onSelect(ep.episode_number)}
            className={cn(
              "flex w-full gap-3 rounded-lg border p-2 text-left transition-colors",
              active ? "border-primary/50 bg-primary/10" : "border-transparent hover:bg-white/5",
            )}
          >
            <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-surface-light">
              {still ? (
                <Image src={still} alt="" fill className="object-cover" sizes="112px" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted">E{ep.episode_number}</div>
              )}
              {active && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Play className="h-5 w-5 fill-white text-white" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <span className={cn("text-xs font-semibold", active ? "text-primary" : "text-muted")}>
                Episode {ep.episode_number}
              </span>
              <p className="truncate text-sm font-medium">{ep.name}</p>
              {ep.overview && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{ep.overview}</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
