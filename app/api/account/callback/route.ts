import { NextRequest, NextResponse } from "next/server";
import { exchangeForSession } from "@/lib/tmdb/account-api";
import {
  PENDING_COOKIE,
  accountsConfigured,
  clearCookie,
  readPending,
  safeReturnTo,
  setSessionCookie,
} from "@/lib/tmdb/account-session";

/**
 * Where TMDB returns the viewer once they have approved — or declined.
 *
 * The request token is read from the pending cookie this browser was given at
 * login, NOT from the query string. TMDB puts the token in the URL, and taking
 * it from there would mean any link of the form `/api/account/callback?
 * request_token=…` could plant a session: an attacker approves a token on their
 * own account, sends the link, and the victim's browser silently signs in as
 * them. Comparing the two closes that, and costs one cookie read.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!accountsConfigured()) {
    return NextResponse.json(
      { error: "Signing in is not configured on this deployment: TMDB_SESSION_SECRET is unset." },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
  }

  const pending = readPending(request.cookies.get(PENDING_COOKIE)?.value);
  const returned = request.nextUrl.searchParams.get("request_token");
  const home = new URL(safeReturnTo(pending?.returnTo), request.nextUrl.origin);

  // Declining on TMDB's page, an expired token, or a callback nobody started:
  // all end the same way — back where they came from, still signed out.
  const denied = request.nextUrl.searchParams.get("approved") === "false";
  const mismatched = !pending || !returned || pending.requestToken !== returned;

  if (denied || mismatched) {
    const response = NextResponse.redirect(home);
    clearCookie(response, PENDING_COOKIE);
    response.headers.set("cache-control", "private, no-store");
    return response;
  }

  const session = await exchangeForSession(pending.requestToken);
  const response = NextResponse.redirect(home);
  clearCookie(response, PENDING_COOKIE);

  // A failed exchange leaves the viewer signed out rather than half-signed-in.
  // There is nothing partial worth keeping: without all four values the account
  // routes cannot serve a single request.
  if (session) setSessionCookie(response, session);

  response.headers.set("cache-control", "private, no-store");
  return response;
}
