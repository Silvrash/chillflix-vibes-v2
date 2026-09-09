import { NextRequest, NextResponse } from "next/server";
import { revokeSession } from "@/lib/tmdb/account-api";
import { SESSION_COOKIE, clearCookie, readSession, safeReturnTo } from "@/lib/tmdb/account-session";

/**
 * POST rather than GET, and answered with a redirect.
 *
 * POST because signing out changes state, so it must not be reachable by a
 * prefetch, a crawler, or an `<img src>` on another site. A redirect because
 * the response has to be a full document navigation: that tears down the
 * module-singleton QueryClient (`lib/tmdb/query-client.ts`), whose 30-minute
 * gcTime would otherwise hold one account's watchlist in memory while the next
 * person signs in on the same tab. Calling this with `fetch` would leave the
 * cache standing — the navigation is the guarantee, not a side effect.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = readSession(request.cookies.get(SESSION_COOKIE)?.value);

  // Hand the credentials back to TMDB, so signing out ends the session rather
  // than just forgetting it. Best-effort: the viewer is signed out here either
  // way, and there is nothing useful to say if TMDB is unreachable.
  if (session) await revokeSession(session);

  const returnTo = safeReturnTo((await request.formData().catch(() => null))?.get("returnTo")?.toString());
  const response = NextResponse.redirect(new URL(returnTo, request.nextUrl.origin), { status: 303 });
  clearCookie(response, SESSION_COOKIE);
  response.headers.set("cache-control", "private, no-store");
  return response;
}
