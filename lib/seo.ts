import type { Metadata } from "next";

export const SITE_NAME = "ChillFlixVibes";
export const SITE_TAGLINE = "Stream Movies, TV & Anime";
export const SITE_DESCRIPTION = "Browse and stream trending movies, TV shows and anime — free, in your browser. Powered by TMDB.";

/**
 * The origin this deployment was told it answers on, or an empty string if it was told nothing.
 * Set `NEXT_PUBLIC_SITE_URL` for a custom domain; on Vercel the project's production URL fills in
 * (a system variable, exposed at build and at run time, and the stable production domain rather
 * than the per-deployment `VERCEL_URL`).
 */
const CONFIGURED_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  ""
).replace(/\/+$/, "");

/** The only origin this app can name without being told: the one a dev server serves itself on. */
const LOCAL_ORIGIN = "http://localhost:3000";

/*
 * Said on the server, where whoever can still fix it reads it — a browser console reaches only the
 * reader, who cannot set an environment variable, and `NEXT_PUBLIC_*` is baked in at build time, so
 * the moment worth shouting at is the build that dropped it rather than the page view that suffers.
 *
 * Worth saying at all because nothing downstream can catch it. The build succeeds and every page
 * renders whether or not an origin was configured; what goes wrong is only visible in what those
 * pages assert about themselves, and a canonical, a sitemap URL and the robots Host are each an
 * absolute address this deployment claims. With nothing configured, every one of them is a guess —
 * and the repo's own Dockerfile passes none of these variables, so an unconfigured build is the
 * ordinary way to self-host rather than an exotic mistake. The build log is the only place left to
 * say so before the guess ships.
 */
if (process.env.NODE_ENV === "production" && !CONFIGURED_ORIGIN && typeof window === "undefined") {
  console.error(
    `[${SITE_NAME}] NEXT_PUBLIC_SITE_URL is not set: canonical URLs, sitemap.xml and robots.txt will all claim ${LOCAL_ORIGIN}, which nothing outside this machine can reach. Set it to this deployment's own origin at build time — see .env.example.`,
  );
}

/**
 * Absolute site origin, used for canonical + Open Graph URLs.
 *
 * Resolved from the environment and never from the request host, because that is what a canonical
 * is for: the same page reached through a preview domain, an alias or a proxy must name one address,
 * or crawlers index several copies of it and social platforms file the same page under several
 * objects.
 *
 * The fallback is deliberately localhost even in production, and deliberately not some real domain.
 * Both are wrong, but this one is wrong in the first line of source anyone looks at and points at
 * nobody else — a plausible-looking third-party domain is a misconfiguration that looks like a
 * working site while the SEO of every page goes somewhere its operator cannot reach.
 */
export const SITE_URL = CONFIGURED_ORIGIN || LOCAL_ORIGIN;

/** SITE_URL as a bare host: no scheme, which is the shape robots.txt's `Host` directive wants. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

/**
 * Social-share / link-preview image (Open Graph + Twitter). Defaults to the
 * bundled `/public/og.png`. To swap the logo without a rebuild, set
 * `NEXT_PUBLIC_OG_IMAGE` to any URL — an absolute URL to an image you host
 * (CDN, Vercel Blob, etc.) lets you replace the artwork at that URL any time
 * with no redeploy. Referenced directly in metadata (never via next/image), so
 * whatever you point it at is what scrapers fetch, untouched.
 */
export const SITE_OG_IMAGE = process.env.NEXT_PUBLIC_OG_IMAGE || "/og.png";

/**
 * The title and the whole link-preview block for one page, from the one name that page goes by.
 *
 * Every field is spelled out rather than left to the root layout, because Next merges metadata one
 * top-level key at a time: a page that sets `openGraph` at all replaces the layout's entire object,
 * and a page that sets none keeps every word of it — which is how a filtered browse link came to
 * unfurl under the site's own front-door title. The suffix the tab gets from the layout's title
 * template is written in by hand for the same reason: a template only reaches `openGraph.title`
 * when the parent spelled it as one, and the layout's is a plain string.
 *
 * The artwork stays the site's own card. A network's TMDB logo is a small transparent wordmark, not
 * a 1200×630 image, and would preview as a smear on whatever colour the reader's client paints
 * behind it; the `alt` names the page instead, so the card is described by what it links to.
 *
 * `path` is written into the canonical and into `og:url` from the one string, so the address the
 * page claims and the address its card points at cannot drift apart. It carries its query string
 * where it has one: Facebook and LinkedIn key a share on `og:url` as the object's permanent id, so
 * a card that names one page while pointing at another is filed — and, on a click, opened — as that
 * other page. Which parameters belong in it is decided by the caller, and the rule the browse pages
 * use is in `browseMetadata`.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const shared = { title: `${title} — ${SITE_NAME}`, description };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      ...shared,
      type: "website",
      siteName: SITE_NAME,
      url: `${SITE_URL}${path}`,
      locale: "en_US",
      images: [{ url: SITE_OG_IMAGE, width: 1200, height: 630, alt: shared.title }],
    },
    twitter: { ...shared, card: "summary_large_image", images: [SITE_OG_IMAGE] },
  };
}

/**
 * The HTTP status behind a failed TMDB fetch, read back out of the message `lib/tmdb/server.ts`
 * throws ("TMDB request failed (404) for movie/1"), or undefined when there is no status to read.
 *
 * That message is the only thing that layer carries about a failure, and one bit of it decides what
 * a route may honestly claim: 404 means no such title exists and never will, so the route is a 404
 * and says so in its status line. Anything else — TMDB's rate limit, which a crawl walking the
 * sitemap is exactly what provokes, or a 5xx — is not an answer about the title at all, so a route
 * that answered 200 with a placeholder would be inventing one.
 *
 * It lives here, beside the metadata it decides, because /media and /watch have to draw that line
 * identically: two routes spelling the same rule apart is a difference nobody would notice until a
 * crawler did.
 */
export function tmdbErrorStatus(error: unknown): number | undefined {
  const match = error instanceof Error ? /\((\d{3})\)/.exec(error.message) : null;
  return match ? Number(match[1]) : undefined;
}

/** Card length. Every platform trims somewhere around here anyway, each at a length of its own. */
const DESCRIPTION_LIMIT = 200;

/**
 * A prose description cut to card length at a word boundary, with an ellipsis to say it was cut.
 *
 * The cut belongs here rather than to the platform because a plot summary is not a sentence anyone
 * can shorten in advance, and cutting to an exact count lands mid-word about as often as not — the
 * synopsis that ended "named the new King of the Pirat" read as a broken page rather than as a
 * blurb. Newlines are folded away too: `content` is one attribute, and a summary that carries
 * paragraph breaks would arrive as a run of spaces in the middle of it.
 */
export function clampDescription(text: string, limit = DESCRIPTION_LIMIT): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  // One character short of the limit, so the ellipsis fits inside it rather than overrunning it.
  const cut = clean.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.!?—–-]+$/, "")}…`;
}

/**
 * The characters that can end an inline `<script>` from inside a JSON string, spelled as the JSON
 * escapes for exactly those characters — so a parser reads back the string that went in.
 */
const INLINE_JSON_ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/**
 * JSON serialised for the body of an inline `<script>` — the only safe way to inline data there.
 *
 * `JSON.stringify` escapes JSON syntax, not HTML. The HTML parser ends a script element at the
 * first `</script` in its text, whatever the JavaScript around it is doing and whatever string it
 * sits inside, so a single value carrying that sequence closes the element early and everything
 * after it is parsed as markup — script tags included, running in this origin, on a page of ours.
 * Every field this app inlines (a title, an overview, a genre) comes from TMDB, which is
 * community-edited, so all of it is text a stranger can choose.
 *
 * Escaping `<` and `>` removes the ability to forge any tag boundary at all rather than blacklisting
 * one spelling of one tag; `&` goes with them because a script in foreign content (inline SVG, an
 * XHTML document) is parsed with entities expanded, where `&lt;/script&gt;` would otherwise arrive
 * as the very sequence the other two just removed. All three, and the two line terminators below
 * them, are written as `\uXXXX` escapes of themselves, which is ordinary JSON: `JSON.parse` and
 * every consumer of the structured data — Google included — reads back the identical object.
 * U+2028 and U+2029 are escaped because they are legal raw inside a JSON string but terminate a
 * line for a JavaScript parser, which is the same forgery one character further along.
 */
export function inlineJson(data: unknown): string {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (char) => INLINE_JSON_ESCAPES[char]);
}
