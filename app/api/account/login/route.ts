import { NextRequest, NextResponse } from "next/server";
import { approvalUrl, createRequestToken } from "@/lib/tmdb/account-api";
import { accountsConfigured, safeReturnTo, setPendingCookie } from "@/lib/tmdb/account-session";
import { SITE_URL } from "@/lib/seo";

/**
 * Starts the TMDB approval round trip.
 *
 * A GET that redirects, so the control that triggers it is an ordinary
 * `<a href>`. That matters twice over: it works before React has hydrated, and
 * `a[href]` is in the focusable set `lib/tv/spatial-nav.ts` walks, so a remote
 * can reach it without any extra work.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!accountsConfigured()) {
    return NextResponse.json(
      { error: "Signing in is not configured on this deployment: TMDB_SESSION_SECRET is unset." },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
  }

  // Prefer the configured origin so a production sign-in cannot be redirected to
  // a preview host, but fall back to the request's own origin so preview and
  // local deployments work without setting anything.
  const origin = SITE_URL.startsWith("http://localhost") ? request.nextUrl.origin : SITE_URL;
  const requestToken = await createRequestToken(`${origin}/api/account/callback`);

  if (!requestToken) {
    return NextResponse.json(
      { error: "Could not reach TMDB to start sign-in." },
      { status: 502, headers: { "cache-control": "private, no-store" } },
    );
  }

  const response = NextResponse.redirect(approvalUrl(requestToken));
  // The callback has no other record of which token this browser was issued —
  // TMDB redirects back bare, with no query string — so this cookie is what the
  // exchange is made from. Which also means a token someone else approved cannot
  // be walked into this browser's session by handing over a crafted link.
  setPendingCookie(response, {
    requestToken,
    returnTo: safeReturnTo(request.nextUrl.searchParams.get("returnTo") ?? undefined),
  });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
