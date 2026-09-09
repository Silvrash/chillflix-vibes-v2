import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";

/**
 * The viewer's TMDB credentials, and the only place they are ever readable.
 *
 * The app's own TMDB token has never reached the browser — the proxy attaches it
 * server-side so it stays out of the bundle. A viewer's credentials are strictly
 * more sensitive (they can write to someone's account), so they follow the same
 * rule: encrypted into an httpOnly cookie, decrypted only inside a route
 * handler, never serialised into a page.
 */
export interface AccountSession {
  /** v4 user access token. Bearer for every `/4/*` call. */
  accessToken: string;
  /** v4 account id — an opaque string, and what `/4/account/{id}/*` wants. */
  accountObjectId: string;
  /** v3 session id, converted from the v4 token. Query param for every `/3/*` call. */
  sessionId: string;
  /** v3 numeric account id, and what `/3/account/{id}/*` wants. Not the same as the v4 one. */
  accountId: number;
  username: string;
  avatarPath: string | null;
}

/** What the browser is allowed to know: who you are, never how to prove it. */
export type AccountProfile = Pick<AccountSession, "accountId" | "accountObjectId" | "username" | "avatarPath">;

export const SESSION_COOKIE = "cfv_tmdb";
export const PENDING_COOKIE = "cfv_pending";

/**
 * Scoped to the account routes, and that is load-bearing rather than tidy.
 *
 * A cookie without a path rides along on every request to the same origin —
 * including `/api/tmdb/*`, whose whole design is a shared `public, s-maxage`
 * cache, and every page route. Some CDNs decline to cache any request carrying
 * a Cookie header at all, so an unscoped cookie would quietly turn the site's
 * cache off for every signed-in viewer. Scoping it here means no cookie reaches
 * the cached proxy or any page.
 */
const COOKIE_PATH = "/api/account";

/** The approval round trip: TMDB's request token is good for 15 minutes. */
const PENDING_MAX_AGE = 15 * 60;

/** TMDB does not expire access tokens; this is how long we ask a browser to hold one. */
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** What was handed out at login, to be checked against what comes back. */
export interface PendingApproval {
  requestToken: string;
  /** Where to send the viewer afterwards. Same-origin relative path only. */
  returnTo: string;
}

function key(): Buffer | undefined {
  const secret = process.env.TMDB_SESSION_SECRET;
  if (!secret) return undefined;
  // A passphrase of any length becomes the 32 bytes AES-256 wants.
  return createHash("sha256").update(secret).digest();
}

/**
 * Whether signing in is configured at all.
 *
 * The account routes answer 503 when it is not, rather than falling open the
 * way `/api/revalidate` does when `REVALIDATE_SECRET` is unset. That is a fair
 * trade for a cache-bust endpoint and the wrong one for a route holding
 * credentials: unset would mean storing them unencrypted.
 */
export function accountsConfigured(): boolean {
  return key() !== undefined;
}

/**
 * AES-256-GCM, so tampering fails to decrypt rather than yielding a plausible
 * session. Output is `iv.tag.ciphertext`, base64url so it needs no cookie
 * escaping. Node's crypto is available in route handlers, so this costs no
 * dependency.
 */
function seal(value: unknown): string | undefined {
  const secret = key();
  if (!secret) return undefined;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}

function open<T>(raw: string | undefined): T | undefined {
  const secret = key();
  if (!secret || !raw) return undefined;
  try {
    const [iv, tag, body] = raw.split(".");
    if (!iv || !tag || !body) return undefined;
    const decipher = createDecipheriv("aes-256-gcm", secret, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as T;
  } catch {
    // A tampered, truncated or stale-key cookie reads as signed out. There is
    // nothing a viewer can do about a bad cookie, so there is nothing to report.
    return undefined;
  }
}

export function readSession(raw: string | undefined): AccountSession | undefined {
  return open<AccountSession>(raw);
}

export function readPending(raw: string | undefined): PendingApproval | undefined {
  return open<PendingApproval>(raw);
}

/** Everything but the credentials — this is what may cross to the browser. */
export function profileOf(session: AccountSession): AccountProfile {
  return {
    accountId: session.accountId,
    accountObjectId: session.accountObjectId,
    username: session.username,
    avatarPath: session.avatarPath,
  };
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    maxAge,
  };
}

export function setSessionCookie(response: NextResponse, session: AccountSession): void {
  const sealed = seal(session);
  if (sealed) response.cookies.set(SESSION_COOKIE, sealed, cookieOptions(SESSION_MAX_AGE));
}

export function setPendingCookie(response: NextResponse, pending: PendingApproval): void {
  const sealed = seal(pending);
  if (sealed) response.cookies.set(PENDING_COOKIE, sealed, cookieOptions(PENDING_MAX_AGE));
}

export function clearCookie(response: NextResponse, name: string): void {
  response.cookies.set(name, "", { ...cookieOptions(0), maxAge: 0 });
}

/**
 * Where to land after approval.
 *
 * TMDB sends the viewer back with whatever `redirect_to` was minted with, but
 * the path we resume to is our own and arrives from a cookie we wrote — so the
 * only real risk is a stale or hand-edited value. A bare `/` is the safe floor,
 * and `//host` is rejected because a protocol-relative URL is an open redirect
 * wearing the shape of a path.
 */
export function safeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
