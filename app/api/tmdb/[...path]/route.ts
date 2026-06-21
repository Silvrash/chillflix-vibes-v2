import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

/**
 * Per-endpoint cache policy. Browser traffic (filter changes, infinite scroll,
 * search) flows through here, so we let Vercel's CDN serve repeats with
 * `stale-while-revalidate` instead of always re-hitting TMDB. `revalidate`
 * mirrors this into the Next.js Data Cache for the upstream fetch itself.
 */
function cachePolicyFor(path: string): { sMaxAge: number; swr: number } {
  const head = path.split("/")[0];
  if (head === "search") return { sMaxAge: 300, swr: 600 }; // search is volatile
  if (head === "discover" || head === "trending") return { sMaxAge: 3600, swr: 86400 };
  return { sMaxAge: 86400, swr: 604800 }; // details, genre, configuration, etc.
}

/**
 * Catch-all proxy to the TMDB REST API. The browser calls `/api/tmdb/<path>`,
 * and this handler forwards the request server-side with the bearer token from
 * the environment so the token never ships to the client.
 */
export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  const token = process.env.TMDB_API_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "TMDB_API_TOKEN is not configured on the server." }, { status: 500 });
  }

  const path = (params.path ?? []).join("/");
  const search = request.nextUrl.search; // includes leading "?" when present
  const url = `${TMDB_BASE_URL}/${path}${search}`;
  const { sMaxAge, swr } = cachePolicyFor(path);

  try {
    const upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json",
      },
      // Cache the upstream TMDB call in the Data Cache; refreshed in background.
      next: { revalidate: sMaxAge },
    });

    const body = await upstream.text();
    const headers: Record<string, string> = {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    };

    // Only let the CDN/browser cache successful responses.
    if (upstream.ok) {
      headers["cache-control"] = `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;
    } else {
      headers["cache-control"] = "no-store";
    }

    return new NextResponse(body, { status: upstream.status, headers });
  } catch (error) {
    return NextResponse.json({ error: "Failed to reach TMDB." }, { status: 502 });
  }
}
