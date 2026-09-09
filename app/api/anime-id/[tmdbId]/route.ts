import { NextRequest, NextResponse } from "next/server";

/**
 * Resolve a TMDB id to its AniList / MyAnimeList id via ani.zip.
 *
 * vidnest's anime player is keyed by AniList id (not TMDB), so anime needs this
 * mapping. The data is effectively static, so it is cached hard.
 *
 * TMDB numbers movies and series in separate namespaces that overlap heavily
 * below ~250k — movie 1429 is "25th Hour", series 1429 is "Attack on Titan" —
 * and ani.zip's lookup takes only `themoviedb_id`, so it answers both with the
 * one mapping it holds. `?type=movie|tv` tells us which namespace the caller
 * meant, so the answer can be checked against ani.zip's own type and withheld
 * when it belongs to the other one. It also splits the CDN entry, which is keyed
 * by the full URL, query string included.
 *
 * The parameter is optional on purpose: sideloaded Android TV and macOS builds
 * request the bare `/api/anime-id/<id>` and cannot be updated remotely, so that
 * form keeps its existing unvalidated behaviour.
 */
const WEEK = 60 * 60 * 24 * 7;

const NO_MAPPING = { anilistId: null, malId: null };

/**
 * ani.zip reports the AniList format, of which only "MOVIE" is reached through
 * a TMDB *movie* id; every episodic format (TV, TV_SHORT, ONA, OVA, SPECIAL)
 * is reached through a TMDB *tv* id — a Netflix ONA is still a series there.
 * A missing or unrecognised format is accepted rather than rejected: a hole in
 * ani.zip's data should cost nobody their anime player, and the fallback for a
 * rejected mapping (the TMDB-keyed lineup) is also what a wrong one would
 * replace, so guessing wrong here is only ever a downgrade, never a mismatch.
 */
function belongsToMediaType(mappingType: unknown, mediaType: "movie" | "tv") {
  if (typeof mappingType !== "string" || mappingType === "") return true;
  return (mappingType.toUpperCase() === "MOVIE") === (mediaType === "movie");
}

export async function GET(request: NextRequest, { params }: { params: { tmdbId: string } }) {
  const tmdbId = parseInt(params.tmdbId, 10);
  if (Number.isNaN(tmdbId)) {
    return NextResponse.json(NO_MAPPING, { status: 400 });
  }

  const requestedType = request.nextUrl.searchParams.get("type");
  const mediaType = requestedType === "movie" || requestedType === "tv" ? requestedType : null;

  try {
    // Keyed on the id alone, which is all ani.zip accepts — one upstream
    // resource, safe to share between callers now that each response is
    // validated against the media type the caller asked about.
    const res = await fetch(`https://api.ani.zip/mappings?themoviedb_id=${tmdbId}`, {
      next: { revalidate: WEEK },
    });
    if (!res.ok) return NextResponse.json(NO_MAPPING);

    const data = await res.json();
    const mappings = data?.mappings ?? {};
    const matched = !mediaType || belongsToMediaType(mappings.type, mediaType);
    return NextResponse.json(matched ? { anilistId: mappings.anilist_id ?? null, malId: mappings.mal_id ?? null } : NO_MAPPING, {
      headers: { "Cache-Control": `public, s-maxage=${WEEK}, stale-while-revalidate=86400` },
    });
  } catch {
    return NextResponse.json(NO_MAPPING);
  }
}
