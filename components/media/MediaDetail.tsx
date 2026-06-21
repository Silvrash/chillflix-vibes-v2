"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, Play, Star } from "lucide-react";
import { useMediaTypeQueries } from "@/lib/tmdb/media-queries";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { formatDate, normalizeRating } from "@/lib/utils";
import { MediaType, type Movie, type TVShow } from "@/lib/tmdb/queries";
import { MediaRail } from "./MediaRail";
import { Spinner } from "@/components/ui/Spinner";

export function MediaDetail({ id, type }: { id: number; type: MediaType }) {
  const { query, recommendedQuery, similarQuery } = useMediaTypeQueries(id, type);

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
  const poster = getTMDBImageUrl(data.poster_path, "w342");

  const recommended = ((recommendedQuery.data?.pages ?? []) as any[]).flatMap((page) => page.results) as (Movie | TVShow)[];
  const similar = ((similarQuery.data?.pages ?? []) as any[]).flatMap((page) => page.results) as (Movie | TVShow)[];

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
          <div className="relative z-10 mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10 sm:mx-0 sm:w-52">
            {poster ? (
              <Image src={poster} alt={title} fill className="object-cover" sizes="208px" />
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

            <Link
              href={`/watch/${type}/${id}`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-dark px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark/90"
            >
              <Play className="h-4 w-4 fill-white" />
              Play Now
            </Link>
          </div>
        </div>

        <div className="mt-12 space-y-10">
          {data.credits?.cast?.length ? <MediaRail title="Cast" items={data.credits.cast} /> : null}
          {recommended.length > 0 && (
            <MediaRail title="Recommended" items={recommended} onEndReached={() => recommendedQuery.fetchNextPage()} />
          )}
          {similar.length > 0 && <MediaRail title="Similar" items={similar} onEndReached={() => similarQuery.fetchNextPage()} />}
          {data.credits?.crew?.length ? <MediaRail title="Crew" items={data.credits.crew} /> : null}
        </div>
      </div>
    </div>
  );
}
