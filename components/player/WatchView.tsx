"use client";

import { MediaRail } from "@/components/media/MediaRail";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { getLastWatched, getPreferredServer, setLastWatched, setPreferredServer } from "@/lib/storage";
import { MOVIE_SERVERS, STREAM_SERVERS, getAnimeServers, type StreamServer } from "@/lib/streaming/vidsrc";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
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
  type TVDetails,
  type TVShow,
} from "@/lib/tmdb/queries";
import { cn, getYear, normalizeRating, pad2 } from "@/lib/utils";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Play, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Player } from "./Player";

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
  const [restored, setRestored] = useState(false);

  // Restore the last-watched season/episode and preferred player on mount.
  useEffect(() => {
    if (isTv) {
      const last = getLastWatched(type, id);
      if (last.season) setSeason(last.season);
      if (last.episode) setEpisode(last.episode);
    }
    const savedServer = getPreferredServer();
    if (savedServer !== undefined) setServerIndex(savedServer);
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember the player the user picks so it's preselected next time.
  function selectServer(index: number) {
    setServerIndex(index);
    setPreferredServer(index);
  }

  // Persist only after the restore has run — otherwise the default season/episode
  // would overwrite the saved value on mount before it's restored.
  useEffect(() => {
    if (isTv && restored) setLastWatched(type, id, season, episode);
  }, [isTv, restored, type, id, season, episode]);

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

  // Anime (Japanese animation) streams from vidnest, which is keyed by AniList id.
  const isAnime = isTv && genres.some((g) => g.id === 16) && tv.data?.original_language === "ja";
  const animeId = useQuery({
    queryKey: ["anime-id", id],
    queryFn: async (): Promise<{ anilistId: number | null }> => {
      const res = await fetch(`/api/anime-id/${id}`);
      if (!res.ok) return { anilistId: null };
      return res.json();
    },
    enabled: isAnime,
    staleTime: Infinity,
  });
  const anilistId = animeId.data?.anilistId ?? null;

  const episodes = seasonDetails.data?.episodes ?? [];
  const currentEpisode = episodes.find((ep) => ep.episode_number === episode);
  const lastEpisodeNumber = episodes.length > 0 ? episodes[episodes.length - 1].episode_number : 1;
  const atFirstEpisode = season <= 1 && episode <= 1;
  const atLastEpisode = totalSeasons > 0 && season >= totalSeasons && episodes.length > 0 && episode >= lastEpisodeNumber;

  // Season-completion / next-season status (shown beneath the episode list).
  const lastEpisode = episodes[episodes.length - 1];
  const seasonComplete = !!lastEpisode?.air_date && !episodeAirInfo(lastEpisode.air_date).upcoming;
  const isLastSeason = totalSeasons > 0 && season >= totalSeasons;
  const showEnded = !!tv.data?.status && /ended|cancell?ed/i.test(tv.data.status);
  const nextSeason = getNextSeasonInfo(tv.data, season);

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

  // Auto-advance: when the vidlink player reports the episode ended, play the
  // next one. A ref keeps the handler on the latest goToNextEpisode so the
  // listener can subscribe once without going stale.
  const goToNextEpisodeRef = useRef(goToNextEpisode);
  useEffect(() => {
    goToNextEpisodeRef.current = goToNextEpisode;
  });
  useEffect(() => {
    if (!isTv) return;
    function onPlayerMessage(event: MessageEvent) {
      if (event.origin !== "https://vidlink.pro") return;
      const payload = event.data;
      if (payload?.type !== "PLAYER_EVENT" || payload.data?.event !== "ended") return;
      // Only advance if the episode that ended is the one currently playing —
      // ignores duplicate or stale "ended" events fired after we've moved on.
      if (parseInt(payload.data.season, 10) !== season || parseInt(payload.data.episode, 10) !== episode) return;
      goToNextEpisodeRef.current();
    }
    window.addEventListener("message", onPlayerMessage);
    return () => window.removeEventListener("message", onPlayerMessage);
  }, [isTv, season, episode]);

  // Anime leads with vidnest (Player 1, dropping vidsrc.to); movies use the
  // two-player lineup; other TV uses the full standard lineup.
  const servers = useMemo<StreamServer[]>(
    () => (isAnime ? getAnimeServers(anilistId) : isTv ? STREAM_SERVERS : MOVIE_SERVERS),
    [isAnime, isTv, anilistId],
  );
  // A remembered index can exceed a shorter lineup — clamp it everywhere.
  const activeServerIndex = Math.min(serverIndex, servers.length - 1);
  const server = servers[activeServerIndex];
  // Hold the iframe until the AniList lookup settles, so anime doesn't briefly
  // load a fallback before switching to vidnest.
  const awaitingAnimeId = isAnime && animeId.isLoading;
  const src = useMemo(
    () => (isTv ? server.getEpisodeLink(id, season, episode, { autoplay: true }) : server.getMovieLink(id, { autoplay: true })),
    [isTv, server, id, season, episode],
  );

  const recs = (((isTv ? tvRecs.data : movieRecs.data)?.pages ?? []) as { results: (Movie | TVShow)[] }[]).flatMap(
    (page) => page.results,
  );

  return (
    <div className="mx-auto max-w-[1700px] px-4 py-6 sm:px-6 lg:px-10">
      <div className={cn("grid gap-6", isTv && "lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]")}>
        {/* Main column: player + controls + info. For movies it fills the width
            but is capped by viewport height so the 16:9 player never overflows. */}
        <div className={cn("min-w-0", !isTv && "mx-auto w-full max-w-[calc(72vh*16/9)]")}>
          {/* On lg, the player + info sticks so the episode list scrolls with the
              page — a single page scrollbar instead of a nested second one. */}
          <div className={cn(isTv && "lg:sticky lg:top-20 lg:self-start")}>
            {awaitingAnimeId ? (
              <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-black ring-1 ring-white/10">
                <Spinner />
              </div>
            ) : (
              <Player src={src} title={title} />
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <ServerTabs servers={servers} value={activeServerIndex} onChange={selectServer} />
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

            <Link href={`/media/${type}/${id}`} title="View details" className="mt-5 inline-block">
              <h1 className="text-2xl font-bold transition-colors hover:text-primary sm:text-3xl">{title ?? "Loading…"}</h1>
            </Link>
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
            {!seasonDetails.isLoading && (
              <SeasonStatusFooter
                complete={seasonComplete}
                seasonNumber={season}
                isLastSeason={isLastSeason}
                showEnded={showEnded}
                inProduction={!!tv.data?.in_production}
                nextSeason={nextSeason}
              />
            )}
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

function ServerTabs({ servers, value, onChange }: { servers: StreamServer[]; value: number; onChange: (index: number) => void }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-white/10 bg-surface p-1">
      {servers.map((srv, index) => (
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

/** Formats an episode's air date; `upcoming` is true only when a future date is known. */
function episodeAirInfo(airDate?: string): { label: string | null; upcoming: boolean } {
  if (!airDate) return { label: null, upcoming: false };
  const date = new Date(`${airDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { label: null, upcoming: false };
  return {
    label: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    upcoming: date.getTime() > Date.now(),
  };
}

/**
 * Find the next, not-yet-released season so we can surface its premiere date.
 * Prefers an explicit future season in `seasons[]`; falls back to a premiere
 * (episode 1) flagged by `next_episode_to_air`. Returns null when nothing is known.
 */
function getNextSeasonInfo(tv: TVDetails | undefined, currentSeason: number): { seasonNumber: number; date: string } | null {
  if (!tv) return null;
  const isFuture = (airDate?: string) => {
    if (!airDate) return false;
    const time = new Date(`${airDate}T00:00:00`).getTime();
    return !Number.isNaN(time) && time > Date.now();
  };

  const upcoming = (tv.seasons ?? [])
    .filter((s) => s.season_number > currentSeason && s.season_number > 0 && isFuture(s.air_date))
    .sort((a, b) => a.season_number - b.season_number)[0];
  if (upcoming) return { seasonNumber: upcoming.season_number, date: upcoming.air_date };

  const next = tv.next_episode_to_air;
  if (next && next.episode_number === 1 && next.season_number > currentSeason && isFuture(next.air_date)) {
    return { seasonNumber: next.season_number, date: next.air_date };
  }
  return null;
}

/** Footer beneath the episode list: marks a finished season and teases the next one. */
function SeasonStatusFooter({
  complete,
  seasonNumber,
  isLastSeason,
  showEnded,
  inProduction,
  nextSeason,
}: {
  complete: boolean;
  seasonNumber: number;
  isLastSeason: boolean;
  showEnded: boolean;
  inProduction: boolean;
  nextSeason: { seasonNumber: number; date: string } | null;
}) {
  if (!complete) return null;
  const seriesEnded = isLastSeason && showEnded;
  const nextDate = nextSeason ? episodeAirInfo(nextSeason.date).label : null;

  return (
    <div className="mt-3 rounded-xl border border-white/5 bg-surface/40 px-3 py-3 text-center">
      <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white/85">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        {seriesEnded ? "Series finale" : `Season ${seasonNumber} complete`}
      </p>
      {nextSeason && nextDate ? (
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs font-medium text-primary">
          <CalendarDays className="h-3.5 w-3.5" />
          Season {nextSeason.seasonNumber} expected {nextDate}
        </p>
      ) : seriesEnded ? (
        <p className="mt-1 text-xs text-muted">This series has ended.</p>
      ) : isLastSeason && inProduction ? (
        <p className="mt-1 text-xs text-muted">Next season in production — date to be announced.</p>
      ) : null}
    </div>
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
    <div ref={listRef} className="space-y-2">
      {episodes.map((ep, index) => {
        const active = ep.episode_number === current;
        const still = getTMDBImageUrl(ep.still_path, "w300");
        const air = episodeAirInfo(ep.air_date);
        const isFinale = episodes.length > 1 && index === episodes.length - 1;
        return (
          <button
            key={ep.id}
            ref={active ? activeRef : undefined}
            type="button"
            onClick={() => onSelect(ep.episode_number)}
            disabled={air.upcoming}
            className={cn(
              "flex w-full gap-3 rounded-lg border p-2 text-left transition-colors",
              active ? "border-primary/50 bg-primary/10" : "border-transparent hover:bg-white/5",
              air.upcoming && "cursor-default opacity-60 hover:bg-transparent",
            )}
          >
            <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-surface-light">
              {still ? (
                <img src={still} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
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
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn("text-xs font-semibold", active ? "text-primary" : "text-muted")}>
                    Episode {ep.episode_number}
                  </span>
                  {isFinale && (
                    <span className="shrink-0 rounded bg-amber-400/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-amber-300">
                      Finale
                    </span>
                  )}
                </span>
                {air.label && (
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 text-[11px]",
                      air.upcoming ? "font-medium text-primary" : "text-muted",
                    )}
                  >
                    <CalendarDays className="h-3 w-3" />
                    {air.upcoming ? `Airs ${air.label}` : air.label}
                  </span>
                )}
              </div>
              <p className="truncate text-sm font-medium">{ep.name}</p>
              {ep.overview && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{ep.overview}</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
