import { NextRequest, NextResponse } from "next/server";
import { exchangeForSession } from "@/lib/tmdb/account-api";
import {
  NATIVE_CALLBACK,
  PENDING_COOKIE,
  accountsConfigured,
  clearCookie,
  readPending,
  safeReturnTo,
  sealSession,
  setSessionCookie,
} from "@/lib/tmdb/account-session";

/**
 * Where TMDB returns the viewer once they have approved — or declined.
 *
 * The request token comes from the pending cookie this browser was given at
 * login, because TMDB's v4 flow does not send it back: it redirects to
 * `redirect_to` with no query string at all, and expects the app to remember
 * which token it issued. Observed directly — the callback arrives bare.
 *
 * That also happens to be the safe shape. Trusting a token from the URL would
 * let anyone approve one on their own account and hand over a link that signs
 * the victim in as them; a token this browser was issued cannot be planted by
 * someone else. Should TMDB ever start echoing it back, a mismatch is still
 * rejected below.
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
  const echoed = request.nextUrl.searchParams.get("request_token");
  const home = new URL(safeReturnTo(pending?.returnTo), request.nextUrl.origin);

  // Declining on TMDB's page, an expired 15-minute token, or a callback nobody
  // started all end the same way: back where they came from, still signed out.
  const denied = request.nextUrl.searchParams.get("approved") === "false";
  const planted = Boolean(echoed) && echoed !== pending?.requestToken;

  if (denied || planted || !pending) {
    const response = NextResponse.redirect(pending?.native ? `${NATIVE_CALLBACK}?denied=1` : home);
    clearCookie(response, PENDING_COOKIE);
    response.headers.set("cache-control", "private, no-store");
    return response;
  }

  const session = await exchangeForSession(pending.requestToken);

  // A native app cannot read a cookie set in the browser it borrowed, so it is
  // handed the same sealed session as a URL, on a scheme only its own
  // authentication session is listening for. Nothing is set in that browser.
  if (pending.native) {
    const sealed = session && sealSession(session);
    const response = NextResponse.redirect(
      sealed ? `${NATIVE_CALLBACK}?session=${encodeURIComponent(sealed)}` : `${NATIVE_CALLBACK}?error=exchange`,
    );
    clearCookie(response, PENDING_COOKIE);
    response.headers.set("cache-control", "private, no-store");
    if (!sealed) console.error("[account] TMDB rejected the token exchange for a native sign-in.");
    return response;
  }

  const response = NextResponse.redirect(home);
  clearCookie(response, PENDING_COOKIE);

  // A failed exchange leaves the viewer signed out rather than half-signed-in.
  // There is nothing partial worth keeping: without all four values the account
  // routes cannot serve a single request. It is logged because from the outside
  // it is indistinguishable from declining, and the difference matters when the
  // cause is a misconfigured key rather than a viewer changing their mind.
  if (session) {
    setSessionCookie(response, session);
  } else {
    console.error("[account] TMDB rejected the token exchange; the viewer stays signed out.");
  }

  response.headers.set("cache-control", "private, no-store");
  return response;
}
