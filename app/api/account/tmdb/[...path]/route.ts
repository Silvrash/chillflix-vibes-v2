import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, type AccountSession, accountsConfigured, readSession } from "@/lib/tmdb/account-session";

/**
 * The authenticated half of the TMDB proxy.
 *
 * This is deliberately a separate route from `app/api/tmdb/[...path]`, not a
 * branch inside it. That one stamps `public, s-maxage=…` on every success and
 * mirrors each call into the shared Next Data Cache, both keyed by URL alone —
 * so a single per-user response returned through it would be handed to the next
 * visitor by the CDN. Adding a `no-store` branch there would work until someone
 * edits `cachePolicyFor` again, and the failure mode is every signed-in
 * viewer's private data on a public CDN. Two files is the cheaper insurance.
 *
 * Keeping it separate also leaves that route byte-identical for the sideloaded
 * Android TV and macOS apps, which call it and cannot be updated remotely.
 */
export const dynamic = "force-dynamic";

const V3 = "https://api.themoviedb.org/3";
const V4 = "https://api.themoviedb.org/4";

const NO_STORE: Record<string, string> = { "cache-control": "private, no-store", vary: "Cookie" };

/**
 * What a signed-in viewer may reach, per method.
 *
 * The public proxy needs no allowlist — every TMDB v3 path it can reach is
 * public data behind the app's own token. This one carries a credential that
 * can write to someone's account, so the reachable surface is exactly the
 * endpoints the features use and nothing else. An unlisted path is a bug or an
 * attempt; either way it should not reach TMDB wearing a viewer's identity.
 */
const ALLOWED: Record<string, RegExp[]> = {
  GET: [
    /^account\/\d+\/(favorite|watchlist|rated)\/(movies|tv)$/,
    /^account\/\d+\/lists$/,
    /^account$/,
    /^(movie|tv)\/\d+\/account_states$/,
    /^4\/account\/[^/]+\/(lists|(movie|tv)\/(recommendations|watchlist|favorites|rated))$/,
    /^4\/list\/\d+$/,
    // The only way to ask whether a title is on a list. `4/list/{id}` answers
    // with one page of items, so scanning it would miss anything past page one.
    /^4\/list\/\d+\/item_status$/,
  ],
  POST: [/^account\/\d+\/(favorite|watchlist)$/, /^(movie|tv)\/\d+\/rating$/, /^4\/list$/, /^4\/list\/\d+\/items$/],
  PUT: [/^4\/list\/\d+$/, /^4\/list\/\d+\/items$/],
  DELETE: [/^(movie|tv)\/\d+\/rating$/, /^4\/list\/\d+$/, /^4\/list\/\d+\/items$/],
};

/**
 * v4 paths authenticate as the viewer with a bearer token; v3 paths authenticate
 * as the app and identify the viewer with a `session_id` query param. One branch
 * covers every endpoint either version offers.
 */
function upstreamFor(path: string, search: URLSearchParams, session: AccountSession) {
  if (path.startsWith("4/")) {
    const query = search.toString();
    return {
      url: `${V4}/${path.slice(2)}${query ? `?${query}` : ""}`,
      token: session.accessToken,
    };
  }
  search.set("session_id", session.sessionId);
  return { url: `${V3}/${path}?${search.toString()}`, token: process.env.TMDB_API_TOKEN ?? "" };
}

async function handle(request: NextRequest, path: string[], method: string): Promise<NextResponse> {
  if (!accountsConfigured()) {
    return NextResponse.json({ error: "Accounts are not configured on this deployment." }, { status: 503, headers: NO_STORE });
  }

  const session = readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401, headers: NO_STORE });

  const joined = (path ?? []).join("/");
  if (!(ALLOWED[method] ?? []).some((allowed) => allowed.test(joined))) {
    return NextResponse.json({ error: "Not an account endpoint." }, { status: 400, headers: NO_STORE });
  }

  // Whatever the caller sent, the identity is ours to decide. Stripping these
  // stops a crafted request from pinning someone else's session or key onto a
  // call the server is about to authenticate.
  const search = new URLSearchParams(request.nextUrl.searchParams);
  search.delete("session_id");
  search.delete("api_key");

  const { url, token } = upstreamFor(joined, search, session);
  // DELETE carries a body here: removing titles is `DELETE 4/list/{id}/items`
  // with `{ items: [...] }`, and dropping it would delete nothing. An empty
  // object is not a body anyone meant to send — axios spells a no-argument
  // DELETE that way — so it is discarded, which leaves the rating delete the
  // bodiless request it has always been.
  const raw = method === "GET" ? "" : await request.text();
  const body = raw === "{}" ? "" : raw;

  try {
    const upstream = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body || undefined,
      // Never the Data Cache: it is keyed by URL and shared by every visitor.
      cache: "no-store",
    });

    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { ...NO_STORE, "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to reach TMDB." }, { status: 502, headers: NO_STORE });
  }
}

type Context = { params: { path: string[] } };

export const GET = (request: NextRequest, { params }: Context) => handle(request, params.path, "GET");
export const POST = (request: NextRequest, { params }: Context) => handle(request, params.path, "POST");
export const PUT = (request: NextRequest, { params }: Context) => handle(request, params.path, "PUT");
export const DELETE = (request: NextRequest, { params }: Context) => handle(request, params.path, "DELETE");
