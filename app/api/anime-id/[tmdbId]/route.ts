import { NextResponse } from "next/server";

/**
 * Resolve a TMDB TV id to its AniList / MyAnimeList id via ani.zip.
 *
 * vidnest's anime player is keyed by AniList id (not TMDB), so anime needs this
 * mapping. The data is effectively static, so it is cached hard.
 */
const WEEK = 60 * 60 * 24 * 7;

export async function GET(_request: Request, { params }: { params: { tmdbId: string } }) {
  const tmdbId = parseInt(params.tmdbId, 10);
  if (Number.isNaN(tmdbId)) {
    return NextResponse.json({ anilistId: null, malId: null }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.ani.zip/mappings?themoviedb_id=${tmdbId}`, {
      next: { revalidate: WEEK },
    });
    if (!res.ok) return NextResponse.json({ anilistId: null, malId: null });

    const data = await res.json();
    const mappings = data?.mappings ?? {};
    return NextResponse.json(
      { anilistId: mappings.anilist_id ?? null, malId: mappings.mal_id ?? null },
      { headers: { "Cache-Control": `public, s-maxage=${WEEK}, stale-while-revalidate=86400` } },
    );
  } catch {
    return NextResponse.json({ anilistId: null, malId: null });
  }
}
