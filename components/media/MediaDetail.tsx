"use client";

import { TitleActions } from "@/components/account";
import { Spinner } from "@/components/ui/Spinner";
import { tmdbGetFn } from "@/lib/tmdb/client";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { useMediaTypeQueries } from "@/lib/tmdb/media-queries";
import {
  MediaType,
  getMovieCreditsQuery,
  getSeasonDetailsQuery,
  getTVCreditsQuery,
  type Cast,
  type Crew,
  type Episode,
  type Genre,
  type Movie,
  type Season,
  type SeasonDetails,
  type TVShow,
  type Video,
} from "@/lib/tmdb/queries";
import { cn, formatDate, normalizeRating, pad2, parseCalendarDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, ChevronDown, Clock, Download, Layers, Play, Star, X, Youtube } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MediaRail, MediaRailSkeleton } from "./MediaRail";

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

  // The season list rides along with the details payload; only the episodes cost
  // a request. That request is keyed to the season on screen, and it is declared
  // up here — with `enabled` off for films — because a hook cannot live inside
  // the TV-only section that uses it.
  const seasons = query.data && "seasons" in query.data ? listableSeasons(query.data.seasons) : [];
  const [chosenSeason, setChosenSeason] = useState<number | null>(null);
  const season = chosenSeason ?? seasons[0]?.season_number ?? 1;
  const seasonQuery = useQuery(
    getSeasonDetailsQuery({
      enabled: !isMovie && seasons.length > 0,
      variables: { tv_id: id, season_number: season },
      // The shared path builder interpolates params only when they're truthy, so
      // season 0 — all a specials-only show has — would ask for `/tv/<id>/season`
      // and 404 forever. Spelling the path out keeps every season fetchable; the
      // key still matches the builder's, so the cache stays shared with the player.
      queryFn: ({ signal }) => tmdbGetFn<SeasonDetails, undefined>(`/tv/${id}/season/${season}`, { signal }),
    }),
  );

  // dlhub.cc is a title-search download site — only surface a Download button
  // when it actually has files for this title.
  const dlhubTitle = query.data ? ("title" in query.data ? query.data.title : query.data.name) : undefined;
  const dlhub = useQuery({
    queryKey: ["dlhub", dlhubTitle],
    queryFn: async (): Promise<{ available: boolean; downloads: DownloadOption[] }> => {
      const res = await fetch(`/api/dlhub?title=${encodeURIComponent(dlhubTitle ?? "")}`);
      return res.ok ? res.json() : { available: false, downloads: [] };
    },
    enabled: !!dlhubTitle,
    staleTime: Infinity,
  });

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
  // w500 (not w342): the poster renders ~192px wide, which is ~384–576px on
  // hi-DPI screens, so a larger source keeps it crisp instead of upscaled.
  const poster = getTMDBImageUrl(data.poster_path, "w500");

  const recommended = ((recommendedQuery.data?.pages ?? []) as any[]).flatMap((page) => page.results) as (Movie | TVShow)[];
  const similar = ((similarQuery.data?.pages ?? []) as any[]).flatMap((page) => page.results) as (Movie | TVShow)[];

  const trailer = pickTrailer(data.videos?.results);

  return (
    <div className="pb-16">
      <DetailHero
        id={id}
        type={type}
        title={title}
        tagline={data.tagline}
        overview={data.overview}
        backdrop={backdrop}
        poster={poster}
        genres={data.genres ?? []}
        rating={data.vote_average}
        releaseDate={releaseDate}
        runtime={runtime}
        runtimeLabel={runtimeLabel}
        totalSeasons={totalSeasons}
        totalEpisodes={totalEpisodes}
        hasTrailer={!!trailer}
        onPlayTrailer={() => setTrailerOpen(true)}
        downloads={dlhub.data?.available ? dlhub.data.downloads : []}
      />

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
        {!isMovie && seasons.length > 0 && (
          <SeasonsSection
            tvId={id}
            seasons={seasons}
            season={season}
            onSelectSeason={setChosenSeason}
            episodes={seasonQuery.data?.episodes ?? []}
            loading={seasonQuery.isLoading}
          />
        )}

        <div className="mt-12 space-y-6">
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

        <div className="mt-12 space-y-12">
          {recommended.length > 0 && (
            <MediaRail title="Recommended" items={recommended} onEndReached={() => recommendedQuery.fetchNextPage()} />
          )}
          {similar.length > 0 && <MediaRail title="Similar" items={similar} onEndReached={() => similarQuery.fetchNextPage()} />}
        </div>
      </div>

      {trailer && trailerOpen && <TrailerModal videoKey={trailer.key} title={title} onClose={() => setTrailerOpen(false)} />}
    </div>
  );
}

interface DetailHeroProps {
  id: number;
  type: MediaType;
  title: string;
  tagline?: string;
  overview: string;
  backdrop: string;
  poster: string;
  genres: Genre[];
  rating: number;
  releaseDate?: string;
  runtime?: number;
  runtimeLabel: string;
  totalSeasons: number | null;
  totalEpisodes: number | null;
  hasTrailer: boolean;
  onPlayTrailer: () => void;
  downloads: DownloadOption[];
}

function DetailHero({
  id,
  type,
  title,
  tagline,
  overview,
  backdrop,
  poster,
  genres,
  rating,
  releaseDate,
  runtime,
  runtimeLabel,
  totalSeasons,
  totalEpisodes,
  hasTrailer,
  onPlayTrailer,
  downloads,
}: DetailHeroProps) {
  return (
    // The copy sits in normal flow rather than pinned to the bottom edge: a long
    // synopsis on a narrow screen then grows the hero instead of spilling out of it.
    <section className="relative flex min-h-[70vh] flex-col justify-end sm:min-h-[78vh]">
      {backdrop && (
        <img src={backdrop} alt={title} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
      {/* The floating nav and Back pill sit over whatever the artwork puts up there. */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />

      <Link
        href={type === MediaType.movie ? "/movies" : "/tv"}
        className="absolute left-4 top-20 z-20 flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm backdrop-blur-2xl transition-colors hover:bg-black/80 sm:left-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="relative mx-auto flex w-full max-w-[1600px] items-end gap-8 px-4 pb-10 pt-36 sm:px-6 lg:px-10 lg:pb-14">
        {/* Literal `aspect-[2/3]`: globals.css carries a padding-top fallback keyed on that
            exact class name for TV browsers older than aspect-ratio. That fallback is a
            percentage padding, which resolves against the CONTAINING BLOCK's width — so the
            width lives on this wrapper and the ratio box fills it. Put both on one element
            and the padding would be measured against this whole flex row instead. */}
        <div className="hidden w-40 shrink-0 md:block lg:w-48">
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-surface-light ring-1 ring-white/10">
            {poster ? (
              <img src={poster} alt={title} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-sm text-muted">{title}</div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-4xl font-extrabold tracking-tight drop-shadow-lg sm:text-5xl lg:text-6xl">{title}</h1>
          {tagline && <p className="mt-2 text-sm italic text-white/60">{tagline}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-accent">
            {rating > 0 && (
              <span className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {normalizeRating(rating)}
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
            {totalSeasons ? (
              <span className="flex items-center gap-1.5">
                <Layers className="h-4 w-4" />
                {totalSeasons} {totalSeasons === 1 ? "Season" : "Seasons"}
                {totalEpisodes ? ` · ${totalEpisodes} Episodes` : ""}
              </span>
            ) : null}
          </div>

          {genres.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {genres.map((genre) => (
                <span
                  key={genre.id}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-xl"
                >
                  {genre.name}
                </span>
              ))}
            </div>
          )}

          {overview && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">{overview}</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/watch/${type}/${id}`}
              className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
            >
              <Play className="h-4 w-4 fill-black" />
              Watch now<span className="sr-only"> {title}</span>
            </Link>
            {hasTrailer && (
              <button
                type="button"
                onClick={onPlayTrailer}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xl transition-colors hover:bg-white/20"
              >
                <Youtube className="h-4 w-4" />
                Trailer
              </button>
            )}
            {downloads.length > 0 && <DownloadMenu downloads={downloads} />}
            {/* Renders nothing when signed out, so this row stays byte-identical for anyone
                who never signs in. It already wraps, so two more buttons need no layout change. */}
            <TitleActions type={type} id={id} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Specials (season 0) are noise beside the real run, but a show with nothing else has to show them. */
function listableSeasons(seasons: Season[]) {
  const regular = (seasons ?? []).filter((entry) => entry.season_number > 0);
  return regular.length > 0 ? regular : (seasons ?? []);
}

function SeasonsSection({
  tvId,
  seasons,
  season,
  onSelectSeason,
  episodes,
  loading,
}: {
  tvId: number;
  seasons: Season[];
  season: number;
  onSelectSeason: (season: number) => void;
  episodes: Episode[];
  loading: boolean;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold sm:text-2xl">Episodes</h2>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {seasons.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelectSeason(entry.season_number)}
            aria-current={entry.season_number === season}
            className={cn(
              "shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              entry.season_number === season
                ? "bg-white text-black"
                : "border border-white/10 bg-white/5 text-accent hover:bg-white/10",
            )}
          >
            {entry.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : episodes.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {episodes.map((episode) => (
            <EpisodeCard key={episode.id} tvId={tvId} season={season} episode={episode} />
          ))}
        </div>
      ) : (
        <p className="py-6 text-sm text-muted">No episodes found for this season.</p>
      )}
    </section>
  );
}

function EpisodeCard({ tvId, season, episode }: { tvId: number; season: number; episode: Episode }) {
  const still = getTMDBImageUrl(episode.still_path, "w300");
  const { label, upcoming } = airStatus(episode.air_date);

  const body = (
    <>
      {/* Literal `aspect-video`, width on the wrapper — see the poster note above. */}
      <div className="w-32 shrink-0 sm:w-36">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-surface-light">
          {still ? (
            <img src={still} alt={episode.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-muted">
              E{pad2(episode.episode_number)}
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold text-white">
          E{pad2(episode.episode_number)} · {episode.name}
        </p>
        {label && <p className="mt-0.5 text-xs text-muted">{upcoming ? `Airs ${label}` : label}</p>}
        {episode.overview && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/70">{episode.overview}</p>}
      </div>
    </>
  );

  const shell = "flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3";

  if (upcoming) return <div className={cn(shell, "opacity-60")}>{body}</div>;

  return (
    <Link
      href={`/watch/tv/${tvId}?season=${season}&episode=${episode.episode_number}`}
      className={cn(shell, "transition-colors hover:bg-white/[0.07] hover:ring-1 hover:ring-white/20")}
    >
      {body}
    </Link>
  );
}

/**
 * Unaired episodes get a date instead of a dead link. Both the cutoff (local
 * midnight on the air date) and the wording come from the shared helpers
 * WatchView also calls, so an episode can't be dimmed here while the watch page
 * happily plays it, nor read as a different day one click later.
 */
function airStatus(airDate?: string): { label: string; upcoming: boolean } {
  const when = parseCalendarDate(airDate);
  if (!when) return { label: "", upcoming: false };
  return { label: formatDate(airDate), upcoming: when.getTime() > Date.now() };
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
        className="flex w-full items-center justify-between gap-3 border-b border-white/10 pb-3 text-left transition-colors hover:border-white/25"
      >
        <span className="flex items-center gap-3">
          <span className="text-xl font-bold sm:text-2xl">{title}</span>
          {open && !loading && items.length > 0 && (
            <span className="rounded-xl bg-white/10 px-2 py-0.5 text-xs font-medium text-muted">{items.length}</span>
          )}
        </span>
        <span className="rounded-xl border border-white/10 bg-white/5 p-1.5">
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="mt-4">
          {loading ? (
            // A spinner box stands ~110px tall and the rail that replaces it needs 370-500px, so
            // every first-time expand dropped the rest of the page by ~370px a beat after the
            // viewer opened it. MediaRailSkeleton is built to the loaded rail's exact height. It
            // gets no title, for the same reason the rail below it gets none — the collapse button
            // is this section's heading — and ten placeholders span the widest content column.
            <MediaRailSkeleton count={10} />
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

interface DownloadOption {
  name: string;
  magnet: string;
}

/**
 * Direct download menu: each item is a magnet link that hands off to the user's
 * torrent client — no navigation to another page.
 */
function DownloadMenu({ downloads }: { downloads: DownloadOption[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xl transition-colors hover:bg-white/20"
      >
        <Download className="h-4 w-4" />
        Download
        <ChevronDown className={cn("h-4 w-4 text-white/60 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 max-h-72 w-[22rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-white/10 bg-black/80 p-1.5 backdrop-blur-2xl">
          <p className="px-3 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
            Torrent · opens your download app
          </p>
          {downloads.map((option) => (
            <a
              key={option.magnet}
              href={option.magnet}
              onClick={() => setOpen(false)}
              className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm leading-snug text-white/90 transition-colors hover:bg-white/10"
            >
              <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/50" />
              <span className="break-words">{option.name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
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

/**
 * The trailer plays in a cross-origin YouTube frame, which is a one-way door on
 * a television: the moment that frame holds focus every key the remote sends
 * goes to YouTube, the Escape below is never heard, and the viewer is shut in
 * with no pointer to click their way out with. The D-pad cannot walk onto it
 * (lib/tv/spatial-nav.ts never makes a frame a destination), the page behind the
 * dialog goes `inert` so the arrows cannot reach controls the backdrop is
 * covering, and in TV mode the frame itself is sealed below — Tab landed on it
 * in one press otherwise, which is the same trap by another key. What is left to
 * move between is the one thing that gets the viewer out, which is where focus
 * starts.
 */
function TrailerModal({ videoKey, title, onClose }: { videoKey: string; title: string; onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Callers spell `onClose` as a fresh arrow function per render, and re-running
  // the effect below would drop the trap and rebuild it — restoring focus to the
  // page behind on the way past — every time the detail page re-renders.
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") latestClose.current();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const inerted: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement) || child.contains(rootRef.current) || child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      inerted.push(child);
    }

    // Sealed the way the watch page seals the player's frame (see
    // components/player/Player.tsx): `inert` keeps a self-focus from inside from
    // ever landing, and the tabindex is for the TV browsers old enough to ignore
    // `inert` — it also takes the frame out of the Tab order, which is how focus
    // was reaching it. Set here rather than in the markup because React 18 has no
    // `inert` prop, and only in TV mode: with a pointer, a click already decides
    // what has focus and the backdrop is still one click from closing this.
    if (document.documentElement.classList.contains("tv")) {
      frameRef.current?.setAttribute("inert", "");
      frameRef.current?.setAttribute("tabindex", "-1");
    }

    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      // Order matters: focus() is a silent no-op on a node that is still inert,
      // and the viewer would be dumped on <body> with no ring to steer by.
      for (const node of inerted) node.removeAttribute("inert");
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — Trailer`}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 animate-fade-in bg-black/80 backdrop-blur-sm" onClick={onClose} />
      {/* Both the Close button and the frame's height are the viewport's to give. `max-w-4xl` is
          56rem, which under html.tv's 20px root is a 1120px frame standing 630px tall, and a 720p
          television has nothing left over: the button hung above it in an absolute `-top-12` sat
          off the top of the screen, the only control of a dialog the viewer could not see. So the
          button is laid out in flow — the space it takes is space the frame cannot — and the frame
          is capped by height as well as width. The 6rem reserve is this dialog's padding plus that
          button and its gap, in rem so that it scales with the root font size exactly as they do. */}
      <div className="relative flex w-full max-w-[min(56rem,calc((100vh-6rem)*16/9))] animate-pop-in flex-col items-end gap-3">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close trailer"
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-xl transition-colors hover:bg-white/20"
        >
          <X className="h-4 w-4" />
          Close
        </button>
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
          <iframe
            ref={frameRef}
            src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0`}
            title={`${title} — Trailer`}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
