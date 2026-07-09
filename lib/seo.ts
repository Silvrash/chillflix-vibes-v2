export const SITE_NAME = "ChillFlixVibes";
export const SITE_TAGLINE = "Stream Movies, TV & Anime";
export const SITE_DESCRIPTION = "Browse and stream trending movies, TV shows and anime — free, in your browser. Powered by TMDB.";

/**
 * Absolute site origin, used for canonical + Open Graph URLs. Set
 * `NEXT_PUBLIC_SITE_URL` for a custom domain; on Vercel it falls back to the
 * project's production URL, and to localhost in local dev.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  "http://localhost:3000"
).replace(/\/+$/, "");

/**
 * Social-share / link-preview image (Open Graph + Twitter). Defaults to the
 * bundled `/public/og.png`. To swap the logo without a rebuild, set
 * `NEXT_PUBLIC_OG_IMAGE` to any URL — an absolute URL to an image you host
 * (CDN, Vercel Blob, etc.) lets you replace the artwork at that URL any time
 * with no redeploy. Referenced directly in metadata (never via next/image), so
 * whatever you point it at is what scrapers fetch, untouched.
 */
export const SITE_OG_IMAGE = process.env.NEXT_PUBLIC_OG_IMAGE || "/og.png";
