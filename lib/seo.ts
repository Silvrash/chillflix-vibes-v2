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
