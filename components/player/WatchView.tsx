"use client";

import { MediaRail } from "@/components/media/MediaRail";
import { Spinner } from "@/components/ui/Spinner";
import { getLastWatched, getPreferredServer, setLastWatched, setPreferredServer } from "@/lib/storage";
import { tmdbGetFn } from "@/lib/tmdb/client";
import { MOVIE_SERVERS, STREAM_SERVERS, getAnimeServers, serverIndexById, type StreamServer } from "@/lib/streaming/vidsrc";
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
  type Season,
  type SeasonDetails,
  type TVDetails,
  type TVShow,
} from "@/lib/tmdb/queries";
import { cn, formatDate, getYear, normalizeRating, pad2, parseCalendarDate } from "@/lib/utils";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Play,
  Star,
} from "lucide-react";
import Link from "next/link";
import { createParser, useQueryStates } from "nuqs";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Player } from "./Player";

/**
 * One half of a position as the URL spells it, or `null` when the URL doesn't
 * name one. Missing, unparseable and below-`min` are deliberately one answer,
 * not two: this is asked both "what plays?" and "did the URL ask for anything at
 * all?", and answering `1` to the first while implying `yes` to the second is
 * what let `?episode=0` throw a resume point away and then overwrite it with
 * S01E01.
 *
 * The floor is a parameter rather than a truthiness check because season 0 is
 * the specials season and a real destination — the detail page links straight
 * into it for shows whose only run is specials.
 */
function parseAsPosition(min: number) {
  return createParser({
    parse: (value: string) => {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) || parsed < min ? null : parsed;
    },
    serialize: (value: number) => String(value),
  });
}

const positionParsers = { season: parseAsPosition(0), episode: parseAsPosition(1) };

/**
 * localStorage is the other store a position can come from, and every reading
 * of it here is deliberately a *reading* — taken at a named moment and then
 * held — rather than a live view of what is in storage now.
 *
 * Neither extreme works. A value copied once at mount goes stale on its own
 * page: a query-only navigation back to a bare /watch/<type>/<id> never
 * remounts this component (the App Router keys the segment without the search
 * string), so the mount-time copy would answer for a position several episodes
 * old — and a bare URL is the one address that means "wherever I left off".
 * A plain live read is worse: `getSnapshot` runs on every render and every
 * commit, subscription or not, so it returns whatever *any* tab last wrote —
 * not as that tab writes it, but at whichever unrelated render this tab happens
 * to do next. The keys are shared: the player preference is a single global
 * one, and a per-title position is held by every tab open on that title. Each
 * such re-read that changes what the player is pointed at destroys and
 * recreates the iframe, so a viewer 45 minutes in restarts from zero because a
 * second tab moved on without them.
 *
 * That is also why no `storage` event is listened for. Dropping that listener
 * was never the fix on its own — the snapshot is what shuts the other tab out.
 */

/** There is no storage to read while server-rendering; React re-reads after hydration. */
const readNothing = () => undefined;

/** A latched value has no store changes to hear about. */
const subscribeToNothing = () => () => {};

/**
 * A stored value, re-read when `view` changes and at no other moment.
 *
 * `view` names the reading rather than the value: "this title, with its
 * position coming from storage" is one reading, and it is taken at the moment
 * that becomes true — at mount, and again when a client-side navigation drops
 * the query string. That is exactly the re-read a bare URL needs, and it is the
 * distinction the live read could not draw: renders in between are not new
 * readings, so a write underneath from another tab is never adopted mid-episode.
 *
 * The reading is cached rather than repeated because `getSnapshot` has to be
 * referentially stable as well as pure: React re-renders whenever two
 * consecutive snapshots differ, so one that computes a fresh answer per call
 * never settles.
 */
function useStoredValuePerView<T>(read: () => T | undefined, view: string): T | undefined {
  const latched = useRef<{ view: string; value: T | undefined } | null>(null);
  const getSnapshot = useCallback(() => {
    if (latched.current?.view !== view) latched.current = { view, value: read() };
    return latched.current.value;
  }, [read, view]);
  // The hydration render takes `readNothing` and never reaches this, so the
  // read happens on the client, at the first moment there is storage to read.
  return useSyncExternalStore(subscribeToNothing, getSnapshot, readNothing);
}

/**
 * One reading for the life of the page — a seed, not a feed.
 *
 * The player preference has no view to be re-read for: it is session state and
 * not a fact about the URL, so nothing that happens on this page makes an older
 * answer the right one. Its single global key makes a re-read worse still —
 * it would adopt whatever any other tab last picked, at whichever unrelated
 * render came next, with nothing on screen to explain why the film just
 * restarted on a different provider.
 */
function useStoredValueOnce<T>(read: () => T | undefined): T | undefined {
  return useStoredValuePerView(read, "session");
}

/** The same two answers as above, asked as a question: is there storage yet? */
const readTrue = () => true;
const readFalse = () => false;

/**
 * `false` through the server render and the hydration render, `true` from the
 * commit after — which is to say, whether a stored position has had its chance
 * to be read.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, readTrue, readFalse);
}

/** Which way prev/next walks — spelled out because "-1" reads as an index step. */
type Direction = "previous" | "next";

/**
 * The nearest episode number on one side of `from` in a season's own list, or
 * `undefined` when the list has none there.
 *
 * Nearest, rather than a step by index, so an episode number the list does not
 * contain still has somewhere to go: a stale bookmark, a link into a season
 * TMDB has since renumbered, or a resume point saved before an episode was
 * pulled all name an episode that is no longer in the list, and an index step
 * would strand both buttons at exactly the position a viewer most needs to
 * leave.
 */
function adjacentEpisodeNumber(episodes: Episode[], from: number, direction: Direction) {
  let nearest: number | undefined;
  for (const { episode_number: candidate } of episodes) {
    const beyond = direction === "next" ? candidate > from : candidate < from;
    if (!beyond) continue;
    if (nearest === undefined || (direction === "next" ? candidate < nearest : candidate > nearest)) nearest = candidate;
  }
  return nearest;
}

/**
 * Where a season begins or ends, by number. The list is not assumed to be in
 * order — it is read for its numbers, and its order is TMDB's business.
 *
 * `1` is the answer only when the list is empty — a season TMDB lists nothing
 * for. The player still has to be pointed at some episode, and E01 is the
 * likeliest one to exist. A request that *failed* never reaches here:
 * `episodeListOf` answers that with `undefined`, and a move with no answer
 * behind it is abandoned rather than guessed at.
 */
function edgeEpisodeNumber(episodes: Episode[], edge: "first" | "last") {
  const numbers = episodes.map((ep) => ep.episode_number);
  if (numbers.length === 0) return 1;
  return edge === "first" ? Math.min(...numbers) : Math.max(...numbers);
}

interface WatchViewProps {
  id: number;
  type: MediaType;
}

export function WatchView({ id, type }: WatchViewProps) {
  const isTv = type === MediaType.tv;
  const queryClient = useQueryClient();

  // The query string is the only record of what is playing, and nuqs reads it
  // through `useSearchParams` on every render instead of copying it at mount.
  // That is what makes back/forward land on the episode the address bar names:
  // the App Router restores an entry's URL while replaying the payload that
  // entry was *pushed* with, so anything derived from that payload — props, or
  // state seeded from them — describes the episode the link named rather than
  // the one the viewer reached. Reading the URL live has no second copy to
  // disagree with, and a re-render is all a restored entry needs.
  //
  // `replace` because the Back button belongs to the page the viewer came from,
  // not to a trail of every episode auto-play walked through. `shallow` because
  // the position is a value only the browser needs — a server round trip per
  // episode would re-run this dynamic page mid-playback.
  const [urlPosition, setUrlPosition] = useQueryStates(positionParsers, { history: "replace", shallow: true });

  // Whether the URL is naming the position at all — asked here because it is
  // half of *which reading* of storage this is, and only afterwards used to
  // decide which of the two sources wins.
  const urlPinsPosition = urlPosition.season !== null || urlPosition.episode !== null;
  const readStoredSeason = useCallback(() => getLastWatched(type, id).season, [type, id]);
  const readStoredEpisode = useCallback(() => getLastWatched(type, id).episode, [type, id]);
  const positionView = `${type}-${id}-${urlPinsPosition ? "url" : "stored"}`;
  const storedSeason = useStoredValuePerView(readStoredSeason, positionView);
  const storedEpisode = useStoredValuePerView(readStoredEpisode, positionView);

  // The player is the one thing on this page that is session state and not a
  // fact about the URL, so it is held in memory and merely *remembered* in
  // storage — read once to seed the session, never watched. Storage is allowed
  // to fail — `store()` hands back nothing in private modes, with storage
  // disabled, and on several smart-TV browsers — and a choice that lived only
  // there could not be made at all: the write no-ops, the read comes back
  // empty, and the buttons stay pinned to the first player however often they
  // are pressed. Switching players is the only answer a viewer has to a
  // provider that won't play, and a television is exactly where they need it.
  //
  // Both halves name a provider rather than a slot, so a preference made on a
  // film still means something on an anime title, where the lineup leads with a
  // different provider entirely — under slot ids the two led with "the first
  // one" and could not be told apart.
  const rememberedServer = useStoredValueOnce(getPreferredServer);
  const [chosenServer, setChosenServer] = useState<string | null>(null);

  // The write path for a move: an episode picked, a season switched, prev/next,
  // auto-advance. (The player gate writes too — see `releasePosition` — and for
  // the same reason: it is a thing the viewer did, not a page being loaded.)
  // Arriving writes nothing, because
  // arriving somewhere is not watching it — a shared link or a stale bookmark
  // already decides what plays, and writing it down would bury a resume point
  // built up over a whole season under an episode the viewer hasn't seen a
  // second of, or pin a bare /watch/tv/<id> — the one entry point that means
  // "wherever I left off" — at S01E01.
  const moveTo = useCallback(
    (nextSeason: number, nextEpisode: number) => {
      setLastWatched(type, id, nextSeason, nextEpisode);
      // The URL is what the page renders from, and it is set on every move, so
      // the stored reading above never has to be refreshed to keep up with this
      // tab: by the time storage is read again the URL has long since said the
      // same thing.
      void setUrlPosition({ season: nextSeason, episode: nextEpisode });
    },
    [type, id, setUrlPosition],
  );

  // The switch happens in memory; the write is only so the next title opens on
  // the same player, and nothing here waits on it or reads it back.
  const selectServer = useCallback((id: string) => {
    setChosenServer(id);
    setPreferredServer(id);
  }, []);

  const movie = useQuery(getMovieDetailsQuery({ enabled: !isTv, variables: { movie_id: id } }));
  const tv = useQuery(getTVDetailsQuery({ enabled: isTv, variables: { tv_id: id } }));
  const totalSeasons = tv.data?.number_of_seasons ?? 0;

  // Every season this show has, and the only list allowed to name one. It is
  // read before the position because the position falls back to it: the details
  // are prefetched into the server render, so it answers on the first render
  // rather than a request later.
  const listedSeasons = useMemo(() => listedSeasonNumbers(tv.data?.seasons, totalSeasons), [tv.data?.seasons, totalSeasons]);

  // The position as last rendered. It is read by the moves below — they await,
  // and an await is time in which the viewer can go somewhere else — and it is
  // the answer of last resort in the derivation just after, which is why it is
  // declared before it rather than beside them.
  const shownPosition = useRef<{ season: number; episode: number } | null>(null);

  // The position, derived rather than stored. A URL that names one wins: the
  // detail page's episode cards link straight at `?season=&episode=`, so a
  // position there is somewhere the viewer just clicked, and it has to outrank
  // where they last stopped. Either half pins both — honouring a season from the
  // URL while restoring the stored episode (or the reverse) would play an
  // episode number against a season nobody chose. Everywhere below, `??` and
  // never `||`: a stored 0 is the specials season, and "is there a stored value"
  // is the only test that can tell it from "nothing stored".
  //
  // With neither source naming a season, the fallback is the first season the
  // show lists, not a literal 1. A show whose only run is specials has no season
  // 1: defaulting into one puts a season the show does not have on the badge,
  // asks the provider for it, and gives prev/next somewhere to walk from and
  // write down. 1 is only the answer while there is no list to consult — a film,
  // or details that have not arrived.
  //
  // With storage silent too, the last thing this page had on screen answers
  // before the show's first season does. That reading is reached only when
  // neither store names a position, so it can contradict neither: what it
  // replaces is a literal S01E01. It is what keeps the player gate honest where
  // storage cannot be written at all — private modes, storage disabled, several
  // smart-TV browsers — because the gate hands the URL back before it opens
  // (see `releasePosition`), and a viewer there would otherwise be thrown to the
  // first episode of the show by pressing OK on the one they were watching.
  const season =
    (urlPinsPosition ? urlPosition.season : (storedSeason ?? shownPosition.current?.season)) ?? listedSeasons[0] ?? 1;
  const episode = (urlPinsPosition ? urlPosition.episode : (storedEpisode ?? shownPosition.current?.episode)) ?? 1;

  // Built for any season, not just the one playing, so stepping back across a
  // season boundary can ask for the season it is about to land on.
  const seasonQueryOptions = useCallback(
    (seasonNumber: number) =>
      getSeasonDetailsQuery({
        enabled: isTv,
        variables: { tv_id: id, season_number: seasonNumber },
        // The shared path builder interpolates params only when they're truthy, so
        // season 0 — the specials season the detail page links into — would ask for
        // `/tv/<id>/season` and 404 forever. Spelling the path out keeps every
        // season fetchable; the key still matches the builder's, so the cache stays
        // shared with the detail page.
        queryFn: ({ signal }) => tmdbGetFn<SeasonDetails, undefined>(`/tv/${id}/season/${seasonNumber}`, { signal }),
      }),
    [isTv, id],
  );
  const seasonDetails = useQuery(seasonQueryOptions(season));
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

  // Anime (Japanese animation) streams from vidnest, which is keyed by AniList
  // id. Films count as much as series: ani.zip maps an anime film by its TMDB
  // *movie* id, and both the embed route and the TV app detect anime without
  // regard to media type — restricting this to TV would leave an anime film on
  // a different player on the web than the one the TV and embed hand a viewer.
  const originalLanguage = isTv ? tv.data?.original_language : movie.data?.original_language;
  const isAnime = genres.some((g) => g.id === 16) && originalLanguage === "ja";
  // The media type is part of the key and part of the request. TMDB numbers
  // movies and series separately and the two ranges overlap heavily, so series
  // 1429 (Attack on Titan) and movie 1429 ("25th Hour") are different titles
  // sharing one number. Without the type this cache entry — `staleTime:
  // Infinity`, and still read when `enabled` is false — hands whichever was
  // opened first its AniList id to the other, and that id now picks the player.
  const animeId = useQuery({
    queryKey: ["anime-id", type, id],
    queryFn: async (): Promise<{ anilistId: number | null }> => {
      const res = await fetch(`/api/anime-id/${id}?type=${type}`);
      if (!res.ok) return { anilistId: null };
      return res.json();
    },
    enabled: isAnime,
    staleTime: Infinity,
  });
  const anilistId = animeId.data?.anilistId ?? null;

  // What the season control can offer. Gating the control on the options
  // themselves shows it whenever there is somewhere else to go, and hides it
  // when there is only one season to be in.
  const seasons = useMemo(() => seasonOptions(listedSeasons, season), [listedSeasons, season]);

  const episodes = seasonDetails.data?.episodes ?? [];
  const currentEpisode = episodes.find((ep) => ep.episode_number === episode);

  // Where prev/next can go, asked once so the buttons and the moves they make
  // can't disagree. Asking `number_of_seasons` for "is there another season"
  // while the control asked the season list is how a specials-only show — zero
  // seasons by that count — ended up with a Next button that rendered enabled,
  // hovered, and did nothing.
  const seasonIndex = seasons.findIndex((option) => option.value === season);
  const previousSeasonNumber = seasonIndex > 0 ? seasons[seasonIndex - 1].value : undefined;
  const nextSeasonNumber = seasonIndex < seasons.length - 1 ? seasons[seasonIndex + 1].value : undefined;

  // Whether there is an episode either side — never a guess at which one. Only
  // the season's own list knows, and it is a second request a few hundred
  // milliseconds behind the details. Standing in for it with the season's
  // `episode_count` is what this used to do, and a count is not a number: Game
  // of Thrones' specials count 300 and run to E314, so the stand-in named
  // episodes that do not exist — the very bug it was added to prevent.
  //
  // So while the list is missing the answer is "maybe", and a click resolves
  // the list before it moves. Not knowing has to count as "there is another
  // one": reading an unanswered season as a finished one is what handed Next to
  // the next SEASON for as long as the list was in flight — tap it there, one
  // click after picking S01E01, and you land on S02E01 having skipped a season,
  // with the move written down as where you left off.
  const knownEpisodes = episodes.length > 0;
  // E01 is the exception in the other direction: nothing can be numbered below
  // it, so Prev is honestly disabled there whether or not the list has landed.
  const hasPreviousEpisode = knownEpisodes ? adjacentEpisodeNumber(episodes, episode, "previous") !== undefined : episode > 1;
  const hasNextEpisode = knownEpisodes ? adjacentEpisodeNumber(episodes, episode, "next") !== undefined : true;
  const atFirstEpisode = !hasPreviousEpisode && previousSeasonNumber === undefined;
  const atLastEpisode = !hasNextEpisode && nextSeasonNumber === undefined;

  // Season-completion / next-season status (shown beneath the episode list).
  const lastEpisode = episodes[episodes.length - 1];
  const seasonComplete = !!lastEpisode?.air_date && !episodeAirInfo(lastEpisode.air_date).upcoming;
  const isLastSeason = totalSeasons > 0 && season >= totalSeasons;
  const showEnded = !!tv.data?.status && /ended|cancell?ed/i.test(tv.data.status);
  const nextSeason = getNextSeasonInfo(tv.data, season);

  useEffect(() => {
    shownPosition.current = { season, episode };
  }, [season, episode]);

  /**
   * Handed to the player gate, and run before it opens.
   *
   * The gate's way out is Back, and Back is a history entry: it pushes a
   * duplicate of this one and closes when that duplicate is popped. But the
   * position is written by REPLACING the entry the page is standing on, which
   * from then on is the duplicate — so an auto-advance while the gate is open
   * left the entry underneath still naming the episode that was playing when it
   * opened, and Back stopped meaning "close the gate" and started meaning "go
   * back an episode". Pushing a fresh entry per move would fix that and break
   * the rule the `replace` above exists for, which is that walking through a
   * series leaves no trail to walk back through.
   *
   * So the two stop sharing an entry: the one left underneath names the title
   * and nothing else. A bare watch URL already means "wherever I left off",
   * which is exactly what coming back out of the player should land on, and it
   * is true whatever the position has done in the meantime. Where the viewer
   * left off is written down here first, because that is the claim the bare URL
   * makes — and pressing OK on the player is the page's one honest signal that
   * this episode is being watched rather than passed through on the way
   * somewhere else.
   */
  const releasePosition = useCallback(async () => {
    // A movie's URL never names a position, and neither does a bare one: there
    // is nothing to release and nothing the entry underneath could get wrong.
    if (!isTv || !urlPinsPosition) return;
    setLastWatched(type, id, season, episode);
    // Awaited because nuqs queues its URL writes: the gate pushes a copy of the
    // URL the moment this resolves, and a copy taken any earlier would carry the
    // position back into the entry this exists to clear.
    await setUrlPosition({ season: null, episode: null });
  }, [isTv, urlPinsPosition, type, id, season, episode, setUrlPosition]);

  // A season's episodes, or `undefined` when there is no answer to give.
  //
  // An empty list and no answer at all are different things, and everything
  // that moves the viewer turns on the difference. A season TMDB lists nothing
  // for genuinely has no next episode; a season whose request failed has one we
  // could not find out about. This used to fold the failure into `[]`, which
  // reads as a finished season: at S01E03 with only the season-1 request
  // failing, one press of Next stepped the viewer into S02E01 and wrote that
  // down as where they had got to. A network blip is not an answer, and the
  // page must not move anyone on one — so a failure returns `undefined`, the
  // same as the other thing that is not an answer, which is the viewer having
  // moved on while the request was in flight.
  //
  // Uncached, that is most of a second with the episode list sitting right
  // there, and picking an episode is the obvious thing to do when a button
  // looks like it did nothing; the later move is the one the viewer meant, so a
  // fetch that lands after it has nothing left to say. `fetchQuery` joins the
  // request already in flight for the season playing rather than starting a
  // second one.
  async function episodeListOf(seasonNumber: number): Promise<Episode[] | undefined> {
    if (seasonNumber === season && knownEpisodes) return episodes;
    const from = shownPosition.current;
    const list = await queryClient
      .fetchQuery(seasonQueryOptions(seasonNumber))
      .then((details) => details.episodes ?? [])
      .catch(() => undefined);
    const now = shownPosition.current;
    if (now?.season !== from?.season || now?.episode !== from?.episode) return undefined;
    return list;
  }

  // The season a pick is still resolving, so the control can say so. Kept here
  // rather than inside the control because only this side knows when the answer
  // has landed — and because a control that owned it would have to be told
  // twice, once to start and once because the season it asked for is now the
  // season playing.
  const [pendingSeason, setPendingSeason] = useState<number | null>(null);
  // The pick that state belongs to: which one it is, and where it is going. Two
  // picks in a row are one control being used, not two — the first answer to
  // come back must not clear the badge the second one is still waiting behind,
  // nor move the viewer to a season they have already changed their mind about.
  //
  // Held in a ref as well as in state because both presses can land inside a
  // single render, and the second has to see the first: reading the rendered
  // `pendingSeason` there reads the copy taken before the first press.
  const pick = useRef({ id: 0, season: null as number | null });

  /**
   * Switching seasons, which is a question about where a season *starts* and
   * never an assumption that it starts at episode 1.
   *
   * This used to move to `(season, 1)` outright. One Piece's season 2 runs
   * E62–E77, so picking it played episode 1 of the whole show, marked no
   * episode in the list as current, and — worse — wrote that invention down as
   * where the viewer had got to. It is the same mistake prev/next made by
   * counting `episode + 1` across TMDB's numbering gaps, and it has the same
   * answer: ask the season's own list.
   *
   * Which means awaiting it, and an uncached season is most of a second. That is
   * exactly why this was left as a guess before — the page's main season control
   * looking dead for a second is its own kind of broken — so the wait is shown
   * on the control instead of hidden: the season being resolved is what it
   * reads, with a spinner where its chevron was. Prev/next already await for the
   * same reason, and they made the same promise about landing somewhere real.
   *
   * A wait is also time in which the viewer can change their mind, so what a
   * pick is measured against is the pick in flight and not the season playing.
   * Measured against the season playing, picking season 1 back while season 2
   * was still loading was read as "you are already in season 1" and dropped: the
   * control went on reading Season 2 with its spinner, never acknowledged the
   * second press, and moved there when the first answer landed.
   */
  async function goToSeason(nextSeason: number) {
    const playing = shownPosition.current?.season ?? season;
    // What the control is already about — the season being resolved while a
    // pick is in flight, the season playing otherwise. Picking that is the OK
    // pressed on the option the list opened onto, and it has nothing to do.
    if (nextSeason === (pick.current.season ?? playing)) return;
    // Every other pick supersedes the one in flight; bumping the id is what
    // leaves the older one's answer with nothing left to do when it lands.
    const id = ++pick.current.id;
    if (nextSeason === playing) {
      // Picking the season still playing, while a different one is being
      // resolved, is the viewer taking that pick back. There is nowhere to go —
      // they never left — so the control just stops waiting.
      pick.current.season = null;
      setPendingSeason(null);
      return;
    }
    pick.current.season = nextSeason;
    setPendingSeason(nextSeason);
    const list = await episodeListOf(nextSeason);
    if (pick.current.id !== id) return;
    pick.current.season = null;
    setPendingSeason(null);
    if (!list) return;
    moveTo(nextSeason, edgeEpisodeNumber(list, "first"));
  }

  // One step through the show, walked along the episode list rather than
  // counted along the episode numbers. The list is the only thing that knows
  // what comes next: TMDB numbering has gaps wherever an episode is unlisted —
  // Game of Thrones' specials run E06 → E09, and again 40 → 42 — so `episode +
  // 1` points the player at an episode that does not exist and `moveTo` writes
  // that down as the viewer's resume point.
  //
  // Crossing a season boundary lands on the far end of the neighbouring season,
  // which is a question for that season's list too — "episode 1" is a guess
  // about where a season starts, and moving to a guess and correcting once the
  // list arrives would load an episode nobody asked for and write it down on
  // the way past. A season the viewer has already been through is usually still
  // cached, so this normally resolves without a request.
  async function stepEpisode(direction: Direction) {
    const from = shownPosition.current ?? { season, episode };
    const withinSeason = await episodeListOf(from.season);
    if (!withinSeason) return;
    const nextInSeason = adjacentEpisodeNumber(withinSeason, from.episode, direction);
    if (nextInSeason !== undefined) {
      moveTo(from.season, nextInSeason);
      return;
    }
    const neighbouringSeason = direction === "previous" ? previousSeasonNumber : nextSeasonNumber;
    if (neighbouringSeason === undefined) return;
    const acrossBoundary = await episodeListOf(neighbouringSeason);
    if (!acrossBoundary) return;
    moveTo(neighbouringSeason, edgeEpisodeNumber(acrossBoundary, direction === "previous" ? "last" : "first"));
  }

  function goToPreviousEpisode() {
    void stepEpisode("previous");
  }

  function goToNextEpisode() {
    void stepEpisode("next");
  }

  // The two halves of the transport track hold each other: whichever of them a
  // press disables hands the remote to the other rather than dropping it. See
  // `EpisodeNavButton`.
  const previousButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);

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

  // Anime leads with vidnest (dropping vidsrc.to); movies use the two-player
  // lineup; other TV uses the full standard lineup. The choice keys
  // off the resolved AniList id rather than `isAnime` — the id is only ever
  // fetched for anime, and an anime title whose id never resolves has to fall
  // back to its own media type's lineup the way the embed route does, where
  // `getAnimeServers(null)` would instead put a third player under a film.
  const servers = useMemo<StreamServer[]>(
    () => (anilistId ? getAnimeServers(anilistId) : isTv ? STREAM_SERVERS : MOVIE_SERVERS),
    [isTv, anilistId],
  );
  // A remembered provider need not be in this lineup at all — vidnest on a film,
  // vidsrc.to on the shorter movie lineup — and then the main player is what
  // plays. Same rule as `/embed` and the TV app, so a preference resolves to the
  // same provider whichever of the three the viewer opened the title in.
  const server = servers[serverIndexById(servers, chosenServer ?? rememberedServer)];
  // Hold the iframe until the AniList lookup settles, so anime doesn't briefly
  // load a fallback before switching to vidnest.
  const awaitingAnimeId = isAnime && animeId.isLoading;
  // And hold it until a stored position has had its chance to be read, for the
  // one address whose position the server cannot know: a bare /watch/tv/<id>
  // means "wherever I left off", and where that is lives in the browser. The
  // server used to answer S01E01 there and be overruled a moment later, which
  // asked the provider for an episode of someone else's show, showed a flash of
  // it, and then destroyed the frame and built another. Nothing else waits: a
  // URL that names the position, and every film, still ship a frame in the HTML.
  const hydrated = useHydrated();
  const awaitingStoredPosition = isTv && !urlPinsPosition && !hydrated;
  // `null` while either of those holds. The Player draws its box either way and
  // leaves it empty until there is a source for it, which is what the page used
  // to do by swapping the whole box for a spinner of its own — a copy that had
  // already drifted (`rounded-xl` against the box's `rounded-2xl`, so the
  // corners jumped as the frame arrived) and that no D-pad could land on, which
  // handed spatial navigation's opening focus to the source picker on whichever
  // cold load the AniList lookup was still in flight at.
  const src = useMemo(
    () =>
      awaitingAnimeId || awaitingStoredPosition
        ? null
        : isTv
          ? server.getEpisodeLink(id, season, episode, { autoplay: true })
          : server.getMovieLink(id, { autoplay: true }),
    [awaitingAnimeId, awaitingStoredPosition, isTv, server, id, season, episode],
  );

  const recs = (((isTv ? tvRecs.data : movieRecs.data)?.pages ?? []) as { results: (Movie | TVShow)[] }[]).flatMap(
    (page) => page.results,
  );

  return (
    // The navbar floats over the page, so the player has to start below it rather than under it.
    <div className="mx-auto max-w-[1700px] px-4 pb-6 pt-24 sm:px-6 sm:pt-28 lg:px-10">
      <div className={cn("grid gap-6", isTv && "lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]")}>
        {/* Main column: player + controls + info. For movies it fills the width
            but is capped by viewport height so the 16:9 player never overflows. */}
        <div className={cn("min-w-0", !isTv && "mx-auto w-full max-w-[calc(72vh*16/9)]")}>
          {/* On lg, the player + info sticks so the episode list scrolls with the
              page — a single page scrollbar instead of a nested second one. */}
          <div className={cn(isTv && "lg:sticky lg:top-20 lg:self-start")}>
            <Player src={src} title={title} onBeforeEngage={releasePosition} />

            {/* Both control groups are the same glass track so they read as one
                row of transport controls; on a phone they stack full-width. */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <ServerTabs servers={servers} value={server.id} onChange={selectServer} />
              {isTv && (
                <div className="flex w-full items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1 sm:w-auto">
                  <EpisodeNavButton
                    direction="prev"
                    disabled={atFirstEpisode}
                    onClick={goToPreviousEpisode}
                    buttonRef={previousButton}
                    handOffTo={nextButton}
                  />
                  <span className="flex-1 px-2 text-center text-sm font-semibold tabular-nums text-white sm:flex-none sm:min-w-[86px]">
                    S{pad2(season)} · E{pad2(episode)}
                  </span>
                  <EpisodeNavButton
                    direction="next"
                    disabled={atLastEpisode}
                    onClick={goToNextEpisode}
                    buttonRef={nextButton}
                    handOffTo={previousButton}
                  />
                </div>
              )}
            </div>

            {/* The title is the way back to the detail page, so it says so with an
                arrow rather than by turning a colour on hover. */}
            <Link href={`/media/${type}/${id}`} title="View details" className="group mt-6 inline-flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title ?? "Loading…"}</h1>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-white/50 transition duration-200 group-hover:-translate-y-0.5 group-hover:text-white" />
            </Link>
            <MetaRow year={year} rating={rating} runtime={runtime} genres={genres} totalSeasons={isTv ? totalSeasons : 0} />

            {isTv && currentEpisode && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Now playing</p>
                <h2 className="mt-1.5 text-base font-semibold sm:text-lg">
                  E{pad2(currentEpisode.episode_number)} · {currentEpisode.name}
                </h2>
                {currentEpisode.overview && (
                  <p className="mt-1.5 text-sm leading-relaxed text-white/70">{currentEpisode.overview}</p>
                )}
              </div>
            )}

            {overview && <p className="mt-5 max-w-3xl text-sm leading-relaxed text-white/70">{overview}</p>}
          </div>
        </div>

        {/* Episodes sidebar (TV only) */}
        {isTv && (
          <aside className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold sm:text-2xl">Episodes</h2>
              {seasons.length > 1 ? (
                <SeasonSelect
                  value={season}
                  options={seasons}
                  pending={pendingSeason}
                  onChange={(value) => void goToSeason(value)}
                />
              ) : (
                // A one-episode season is the specials-only show this season
                // handling exists for, so it is the case that shows up.
                episodes.length > 0 && (
                  <span className="text-xs text-muted">
                    {episodes.length} {episodes.length === 1 ? "episode" : "episodes"}
                  </span>
                )
              )}
            </div>
            <EpisodeList
              episodes={episodes}
              loading={seasonDetails.isLoading}
              current={episode}
              onSelect={(value) => moveTo(season, value)}
            />
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
        <div className="mt-14 sm:mt-16">
          <MediaRail title="More Like This" items={recs} />
        </div>
      )}
    </div>
  );
}

/**
 * The seasons the show is taken to have: what the control offers, the whole of
 * where prev/next may go, and the season to play when nothing else names one.
 *
 * The show's own season list is the answer whenever it has loaded — it carries
 * the specials TMDB leaves out of `number_of_seasons`, which counts the regular
 * run only and so reports 0 for a show whose entire run is specials — but pared
 * back the same way the detail page pares it (`listableSeasons`): specials are
 * dropped wherever there is a regular run, and kept when they are the entire
 * show. The two pages have to reach the same answer or they contradict each
 * other about what a show even has: a Prev button enabled at S01E01 steps
 * backwards into a Specials season the page the viewer arrived from would not
 * show them. `number_of_seasons` is the stand-in until the details arrive.
 *
 * Sorted, because the first entry is what a bare /watch/<type>/<id> plays.
 */
function listedSeasonNumbers(seasons: Season[] | undefined, totalSeasons: number) {
  const all = seasons?.length
    ? seasons.map((entry) => entry.season_number)
    : Array.from({ length: totalSeasons }, (_, index) => index + 1);
  const regular = all.filter((value) => value > 0);
  return (regular.length > 0 ? regular : all).sort((a, b) => a - b);
}

/**
 * The season control's options: the seasons above, plus the one playing.
 *
 * The season playing is always included, even when the pared list leaves it out
 * — Specials while you are actually in Specials, and equally a stale bookmark or
 * a stored position from before TMDB renumbered or dropped a season. It is
 * listed as itself rather than silently corrected, because it is what is
 * playing, and because a control whose value is in no option has nothing to
 * name itself with while that season plays on. So specials can be resumed into
 * and left, which is the pair of moves the detail page's own list allows.
 *
 * Copied rather than appended to: the list handed in is memoized, and one push
 * would leave the extra season in it for every later render.
 */
function seasonOptions(listed: number[], season: number) {
  const numbers = listed.includes(season) ? listed : [...listed, season].sort((a, b) => a - b);
  return numbers.map((value) => ({ label: value === 0 ? "Specials" : `Season ${value}`, value }));
}

/**
 * The most-used control on the page — a viewer's only recourse when a provider
 * won't play — so it is drawn as a deliberate segmented control: one glass
 * track, the chosen source in the site's solid-white active state.
 */
function ServerTabs({ servers, value, onChange }: { servers: StreamServer[]; value: string; onChange: (id: string) => void }) {
  return (
    // Three labels at the desktop size overflow a 375px screen, and wrapping
    // them breaks one control into two ragged rows. On phones the group instead
    // takes the full width, sharing it equally between the short form of each
    // name, so it stays a single row of pills inside one border.
    <div className="flex w-full items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1 sm:w-auto">
      {servers.map((srv) => (
        <button
          key={srv.id}
          type="button"
          onClick={() => onChange(srv.id)}
          // The visible label is shortened on phones, so the full name is spelled
          // out here — it is what the control is announced as at either size.
          aria-label={srv.name}
          aria-pressed={srv.id === value}
          className={cn(
            "flex-1 basis-0 whitespace-nowrap rounded-xl px-3 py-2 text-center text-xs font-semibold transition-colors sm:flex-none sm:px-4 sm:text-sm",
            srv.id === value ? "bg-white text-black" : "text-muted hover:bg-white/10 hover:text-white",
          )}
        >
          <span className="sm:hidden">{shortServerName(srv.name)}</span>
          <span className="hidden sm:inline">{srv.name}</span>
        </button>
      ))}
    </div>
  );
}

/** Beside its siblings, "Main Player" is carried by "Main" — every name ends in the same word. */
function shortServerName(name: string) {
  return name.replace(/\s+player$/i, "");
}

/**
 * The season control's options, in the order they are on screen. Asked of the
 * DOM rather than tracked, because what they are asked for is where focus is
 * and where it can go next, and the elements are the only thing that knows.
 */
function optionsIn(root: HTMLElement | null) {
  return Array.from(root?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
}

/**
 * The season control: a list this page draws itself, out of the same buttons
 * everything else on the page is made of.
 *
 * It was a native <select> for a good reason — a D-pad reaches one like any
 * other control, and the platform draws the list over the player with nothing
 * here to trap or restore focus. What that leans on is the platform *having* a
 * list to draw. Every other control on this page answers OK by doing the thing
 * itself; this one asked the browser to open a menu, and on a television whose
 * browser answers OK with nothing there was then no route to another season at
 * all — the picker is the only place the other seasons are named.
 *
 * So the list is ours: OK opens it, OK picks from it, and the arrows walk it the
 * way they walk the episode cards underneath. Only OK opens it — an arrow is
 * already spatial navigation's on a television, and a control that both moved
 * focus and opened a list would be doing two things to one press. Nothing here
 * traps focus either: arrowing off either end, or tabbing away, simply leaves —
 * and leaving closes the list, so a remote can never be shut inside something it
 * cannot see the edge of.
 */
function SeasonSelect({
  value,
  options,
  pending,
  onChange,
}: {
  value: number;
  options: { label: string; value: number }[];
  pending: number | null;
  onChange: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // The season the control is *about*: the one being resolved while a pick is in
  // flight, and the one playing otherwise. A control that went on reading the
  // old season for the second it takes to answer is the dead-looking control
  // this list exists to replace.
  const shown = pending ?? value;
  const label = options.find((option) => option.value === shown)?.label ?? `Season ${shown}`;

  // Opening lands on the season already showing, so the first thing under the
  // remote is where the viewer is, and OK twice changes nothing.
  useEffect(() => {
    if (!open) return;
    const current = optionsIn(rootRef.current).find((option) => option.getAttribute("aria-selected") === "true");
    current?.focus({ preventScroll: true });
    current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  function close() {
    setOpen(false);
    // The list is unmounted on the way out, so focus has to be put somewhere
    // deliberately: an element that disappears from under a D-pad leaves the
    // remote pointed at nothing, and the next arrow starts again from the top of
    // the page.
    triggerRef.current?.focus({ preventScroll: true });
  }

  function step(delta: number) {
    const items = optionsIn(rootRef.current);
    if (items.length === 0) return;
    const from = items.indexOf(document.activeElement as HTMLElement);
    const index = from < 0 ? items.findIndex((item) => item.getAttribute("aria-selected") === "true") : from + delta;
    const next = items[Math.min(Math.max(index, 0), items.length - 1)];
    next?.focus();
    next?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div
      ref={rootRef}
      className="relative w-40 shrink-0"
      // Focus leaving the control is the one thing that always means "done with
      // it" — a click elsewhere, a Tab, or a D-pad arrowing off the end of the
      // list — and it covers all three without a listener on the document.
      // Moving between the button and its own list is not leaving.
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        // Spatial navigation has first refusal on the arrows in TV mode and
        // marks the ones it acted on. It moves between these options by geometry
        // exactly as this would, so stepping again here would step twice.
        if (event.defaultPrevented) return;
        if (!open) return;
        if (event.key === "Escape") {
          event.preventDefault();
          close();
          return;
        }
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        step(event.key === "ArrowDown" ? 1 : -1);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Season"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        // Busy rather than disabled: a disabled control is one spatial-nav skips
        // and focus falls off, which is a strange thing to do to a viewer for
        // the second after they used it.
        aria-busy={pending !== null}
        onClick={() => (open ? close() : setOpen(true))}
        // The browser's own focus ring goes and the site's takes its place, so
        // this control is lit the way the pills and cards around it are. TV
        // mode's focus shadow is more specific and still wins.
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.06] py-2 pl-3.5 pr-3 text-sm font-semibold text-white outline-none transition-colors hover:bg-white/10 focus:border-white/30 focus:ring-1 focus:ring-white/25"
      >
        <span className="truncate">{label}</span>
        {pending !== null ? (
          <Spinner className="h-4 w-4 shrink-0 text-white/70" />
        ) : (
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
        )}
      </button>

      {open && (
        // Over the episode list rather than pushing it down, the way the native
        // menu was: the seasons are a choice about that list, not a part of it.
        <div
          id={listId}
          role="listbox"
          aria-label="Season"
          className="absolute right-0 top-full z-30 mt-2 max-h-[19rem] w-full overflow-y-auto rounded-xl border border-white/10 bg-surface p-1 shadow-2xl shadow-black/60"
        >
          {options.map((option) => {
            const selected = option.value === shown;
            return (
              // The detail page's season pills, stacked: a viewer choosing a
              // season there and choosing one here should not be looking at two
              // different kinds of thing.
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  close();
                  onChange(option.value);
                }}
                className={cn(
                  "block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  selected ? "bg-white text-black" : "text-accent hover:bg-white/10 hover:text-white",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
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
    // The detail hero's meta row, condensed for a page that shares the fold
    // with a 16:9 player: the same grey line of icon-and-fact pairs, but a year
    // where the hero spells out a release date, no episode total beside the
    // season count, and only the first few genres. The chips ride this row
    // rather than a line of their own — the hero's two-line arrangement is a
    // hundred pixels the video would have to give up.
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-accent">
      <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {rating !== undefined && rating > 0 && (
          <span className="flex items-center gap-1.5 font-semibold">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            {normalizeRating(rating)}
          </span>
        )}
        {year && (
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {year}
          </span>
        )}
        {runtime ? (
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {runtime} min
          </span>
        ) : null}
        {totalSeasons > 0 && (
          <span className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            {totalSeasons} Season{totalSeasons > 1 ? "s" : ""}
          </span>
        )}
      </span>
      {genres.length > 0 && (
        <span className="flex flex-wrap items-center gap-2">
          {genres.slice(0, 3).map((genre) => (
            // The detail hero's chip, minus its `backdrop-blur-xl`: there the
            // chip sits on artwork and the blur is what separates it from the
            // still behind, here it sits on flat ground with nothing to blur.
            // The fill and the white text stay — dimming them was the one
            // difference a viewer coming from the detail page would read as a
            // different control rather than the same one on a plainer page.
            <span
              key={genre.id}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white"
            >
              {genre.name}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

function EpisodeNavButton({
  direction,
  disabled,
  onClick,
  buttonRef,
  handOffTo,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
  buttonRef: RefObject<HTMLButtonElement>;
  handOffTo: RefObject<HTMLButtonElement>;
}) {
  const isPrev = direction === "prev";

  // A control that answers a press by disabling itself takes the D-pad down
  // with it: the browser drops a disabled element's focus on the floor, so the
  // ring leaves the page entirely and the next arrow starts again at the navbar,
  // scrolling the viewer clean off the player. Prev at S01E02 lands S01E01 and
  // does exactly that; so does Next onto a finale. The way out is to hand the
  // remote to the opposite button, which the move just made is what guarantees
  // is enabled — you can only reach one end by coming from the other.
  //
  // Asked afterwards rather than before, because there is no before: the blur
  // has already happened by the time React can run anything, and the focused
  // element of nothing it leaves behind is the whole signal. Which is also what
  // keeps this from stealing a ring: focus resting anywhere else means this
  // button did not have it, and nothing is taken from wherever it is.
  const wasDisabled = useRef(disabled);
  useEffect(() => {
    const justDisabled = disabled && !wasDisabled.current;
    wasDisabled.current = disabled;
    if (!justDisabled) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    handOffTo.current?.focus({ preventScroll: true });
  }, [disabled, handOffTo]);

  return (
    // A pill inside the transport track, not a bordered button of its own — the
    // track is the border. Still genuinely `disabled` at either end of the show:
    // spatial-nav skips disabled buttons, so a D-pad never lands on one that
    // would do nothing.
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrev ? "Previous episode" : "Next episode"}
      className={cn(
        "flex items-center gap-1 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors sm:px-3",
        disabled ? "cursor-not-allowed text-white/30" : "text-accent hover:bg-white/10 hover:text-white",
      )}
    >
      {isPrev && <ChevronLeft className="h-4 w-4" />}
      <span className="hidden sm:inline">{isPrev ? "Prev" : "Next"}</span>
      {!isPrev && <ChevronRight className="h-4 w-4" />}
    </button>
  );
}

/**
 * Formats an episode's air date; `upcoming` is true only when a future date is
 * known. Both halves come from the shared helpers so this page and the detail
 * page can't drift apart on either the wording or the aired/unaired cutoff.
 */
function episodeAirInfo(airDate?: string): { label: string | null; upcoming: boolean } {
  const date = parseCalendarDate(airDate);
  if (!date) return { label: null, upcoming: false };
  return { label: formatDate(airDate), upcoming: date.getTime() > Date.now() };
}

/**
 * Find the next, not-yet-released season so we can surface its premiere date.
 * Prefers an explicit future season in `seasons[]`; falls back to a premiere
 * (episode 1) flagged by `next_episode_to_air`. Returns null when nothing is known.
 */
function getNextSeasonInfo(tv: TVDetails | undefined, currentSeason: number): { seasonNumber: number; date: string } | null {
  if (!tv) return null;
  const isFuture = (airDate?: string) => {
    const when = parseCalendarDate(airDate);
    return !!when && when.getTime() > Date.now();
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
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
      <p className="flex items-center justify-center gap-2 text-sm font-semibold text-white">
        <CheckCircle2 className="h-4 w-4 text-white/60" />
        {seriesEnded ? "Series finale" : `Season ${seasonNumber} complete`}
      </p>
      {nextSeason && nextDate ? (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-accent">
          <CalendarDays className="h-3.5 w-3.5" />
          Season {nextSeason.seasonNumber} expected {nextDate}
        </p>
      ) : seriesEnded ? (
        <p className="mt-1.5 text-xs text-muted">This series has ended.</p>
      ) : isLastSeason && inProduction ? (
        <p className="mt-1.5 text-xs text-muted">Next season in production — date to be announced.</p>
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
  if (loading) {
    return (
      <div className="flex justify-center rounded-2xl border border-white/10 bg-white/[0.02] py-16">
        <Spinner />
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-muted">
        No episodes found for this season.
      </p>
    );
  }

  return (
    // The list scrolls with the page rather than inside itself — one scrollbar
    // on the page, not a second nested one — which is also why nothing here
    // scrolls the active episode into view: there is no container scroll to
    // move, and moving the page under a viewer who just pressed Next would take
    // the player off screen.
    <div className="space-y-2.5">
      {episodes.map((ep, index) => {
        const active = ep.episode_number === current;
        const still = getTMDBImageUrl(ep.still_path, "w300");
        const air = episodeAirInfo(ep.air_date);
        const isFinale = episodes.length > 1 && index === episodes.length - 1;
        return (
          // The same card the detail page's episode grid uses, laid out as a row:
          // a viewer picking an episode there and picking one here should not be
          // looking at two different kinds of thing.
          <button
            key={ep.id}
            type="button"
            onClick={() => onSelect(ep.episode_number)}
            disabled={air.upcoming}
            aria-current={active}
            className={cn(
              "flex w-full gap-3 rounded-2xl border p-2.5 text-left transition",
              active ? "border-white/25 bg-white/[0.08]" : "border-white/10 bg-white/[0.03]",
              air.upcoming ? "cursor-default opacity-60" : "hover:bg-white/[0.09] hover:ring-1 hover:ring-white/20",
            )}
          >
            {/* Literal `aspect-video`, with the width on this wrapper: globals.css's
                pre-aspect-ratio fallback for old TV browsers is a percentage padding,
                and percentages resolve against the containing block — put both on one
                flex item and the still is sized off the whole row instead of off w-28. */}
            <div className="w-28 shrink-0">
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-surface-light">
                {still ? (
                  <img src={still} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-muted">
                    E{pad2(ep.episode_number)}
                  </span>
                )}
                {active && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                      <Play className="h-3.5 w-3.5 fill-black text-black" />
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", active ? "text-white" : "text-muted")}
                  >
                    E{pad2(ep.episode_number)}
                  </span>
                  {isFinale && (
                    <span className="shrink-0 rounded-full bg-white/10 px-2 py-px text-[10px] font-bold uppercase tracking-wide text-white/80">
                      Finale
                    </span>
                  )}
                </span>
                {air.label && (
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 text-[11px]",
                      air.upcoming ? "font-medium text-white/75" : "text-muted",
                    )}
                  >
                    <CalendarDays className="h-3 w-3" />
                    {air.upcoming ? `Airs ${air.label}` : air.label}
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-sm font-semibold text-white">{ep.name}</p>
              {ep.overview && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{ep.overview}</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
