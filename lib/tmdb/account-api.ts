import "server-only";

import type { AccountSession } from "./account-session";

const V3 = "https://api.themoviedb.org/3";
const V4 = "https://api.themoviedb.org/4";

/**
 * The app's own token, which is also what authorises the v4 auth handshake —
 * minting and exchanging a request token is done as the application, not as the
 * viewer. The viewer's own token only exists once the exchange succeeds.
 */
function appToken(): string | undefined {
  return process.env.TMDB_API_TOKEN;
}

/**
 * Every call here is a credential exchange or an account read, so none of it may
 * be cached: `no-store` keeps it out of the Next Data Cache, which is keyed by
 * URL and shared across every visitor.
 */
async function post<T>(url: string, body: unknown, token: string): Promise<T | undefined> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

/**
 * Step 1: ask TMDB for a request token, naming where to send the viewer back.
 *
 * `redirect_to` is set here rather than on the approval URL, which is v4's
 * improvement over v3 — the page the viewer sees carries nothing but the token.
 * The token is good for 15 minutes.
 */
export async function createRequestToken(redirectTo: string): Promise<string | undefined> {
  const token = appToken();
  if (!token) return undefined;
  const result = await post<{ request_token?: string }>(`${V4}/auth/request_token`, { redirect_to: redirectTo }, token);
  return result?.request_token;
}

/** Where the viewer approves. Nothing secret is in this URL — the token is single-use and unapproved. */
export function approvalUrl(requestToken: string): string {
  return `https://www.themoviedb.org/auth/access?request_token=${encodeURIComponent(requestToken)}`;
}

/**
 * Steps 2-4: turn an approved request token into a full session.
 *
 * Four calls, because TMDB's two API versions each hold half of what the app
 * needs. v4 gives the access token that authorises lists and recommendations;
 * v3 owns every *write* for favourite, watchlist and rating, and its endpoints
 * are keyed by a numeric account id that only `/3/account` will tell you. So a
 * v4-only session could not add a title to a watchlist, and a v3-only one could
 * not manage a list. Both, once, at sign-in.
 */
export async function exchangeForSession(requestToken: string): Promise<AccountSession | undefined> {
  const token = appToken();
  if (!token) return undefined;

  const access = await post<{ access_token?: string; account_id?: string }>(
    `${V4}/auth/access_token`,
    { request_token: requestToken },
    token,
  );
  if (!access?.access_token || !access.account_id) return undefined;

  const converted = await post<{ session_id?: string }>(
    `${V3}/authentication/session/convert/4`,
    { access_token: access.access_token },
    token,
  );
  if (!converted?.session_id) return undefined;

  const account = await accountDetails(converted.session_id, token);
  if (!account) return undefined;

  return {
    accessToken: access.access_token,
    accountObjectId: access.account_id,
    sessionId: converted.session_id,
    accountId: account.id,
    username: account.username,
    avatarPath: account.avatarPath,
  };
}

async function accountDetails(
  sessionId: string,
  token: string,
): Promise<{ id: number; username: string; avatarPath: string | null } | undefined> {
  try {
    const response = await fetch(`${V3}/account?session_id=${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as {
      id?: number;
      username?: string;
      avatar?: { tmdb?: { avatar_path?: string | null } };
    };
    if (typeof body.id !== "number") return undefined;
    return {
      id: body.id,
      username: body.username ?? "",
      avatarPath: body.avatar?.tmdb?.avatar_path ?? null,
    };
  } catch {
    return undefined;
  }
}

/**
 * Give the credentials back to TMDB on the way out.
 *
 * Clearing our cookie alone would leave a live access token on TMDB's side that
 * nothing can reach — signing out ought to actually end the session, not just
 * forget where it was written down. Failures are ignored: a viewer who pressed
 * sign out is signed out regardless of what TMDB says about it.
 */
export async function revokeSession(session: AccountSession): Promise<void> {
  const token = appToken();
  if (!token) return;
  await Promise.allSettled([
    fetch(`${V4}/auth/access_token`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ access_token: session.accessToken }),
      cache: "no-store",
    }),
    fetch(`${V3}/authentication/session`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ session_id: session.sessionId }),
      cache: "no-store",
    }),
  ]);
}
