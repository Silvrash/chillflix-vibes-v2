import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, profileOf, readSession } from "@/lib/tmdb/account-session";

/**
 * The single source of truth for "am I signed in", and the only account state
 * the browser is given.
 *
 * It exists because the session cookie is scoped to `/api/account` and is
 * httpOnly, so the client cannot read it — which is the point. The alternative,
 * reading cookies in the root layout, would render every page dynamically and
 * destroy the 24-hour ISR on the detail page and the static home page for the
 * sake of a name in the navbar.
 *
 * It answers with the profile only. The access token, the session id and the
 * request token never leave the server.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store", vary: "Cookie" };

export async function GET(request: NextRequest) {
  const session = readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ signedIn: false }, { headers: NO_STORE });
  return NextResponse.json({ signedIn: true, ...profileOf(session) }, { headers: NO_STORE });
}
