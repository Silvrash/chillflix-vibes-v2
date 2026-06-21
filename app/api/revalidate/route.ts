import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

/**
 * On-demand cache revalidation for the TMDB data layer. Combined with the
 * time-based `revalidate` on the server fetchers (lib/tmdb/server.ts), this lets
 * a scheduled job proactively refresh the cache in the background so users never
 * hit a cold/stale entry.
 *
 * Wire it up on Vercel with a Cron in `vercel.json`, e.g.:
 *   { "crons": [{ "path": "/api/revalidate?tag=trending", "schedule": "0 * * * *" }] }
 * and set REVALIDATE_SECRET (sent as `?secret=` or `Authorization: Bearer`).
 */
const VALID_TAGS = new Set(["tmdb", "trending", "discover", "genres", "details"]);

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return true; // no secret configured → open (dev convenience)
  const provided =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-revalidate-secret");
  return provided === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tag = request.nextUrl.searchParams.get("tag") ?? "tmdb";
  if (!VALID_TAGS.has(tag)) {
    return NextResponse.json({ error: `Unknown tag: ${tag}` }, { status: 400 });
  }

  revalidateTag(tag);
  return NextResponse.json({ revalidated: true, tag });
}

export const POST = GET;
