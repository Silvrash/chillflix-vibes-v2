"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard } from "lucide-react";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

const BROWSE = [
  { href: "/", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/tv", label: "TV Shows" },
  { href: "/anime", label: "Anime" },
];

/**
 * The bottom edge of the site.
 *
 * A hairline and a lot of air rather than a filled slab: the pages above it end
 * on artwork, and a heavy block would read as a second surface competing with
 * the posters. Its real job is to say the page is over — and to carry the TMDB
 * acknowledgement, which every catalogue title, still and rating on the site is
 * sourced from.
 */
export function Footer() {
  const pathname = usePathname();

  // `/embed` is the chrome-less player the TV app loads — same rule the navbar
  // follows, so the two never disagree about what counts as page furniture.
  if (pathname?.startsWith("/embed")) return null;

  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6 sm:py-14 lg:px-10">
        {/* Fixed-width link columns rather than fractions: on a wide monitor a `1fr` column
            would stretch four short words across 400px and read as a broken table. */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,11rem))] lg:gap-16">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 rounded-xl">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-dark text-white">
                <Clapperboard className="h-5 w-5" />
              </span>
              <span className="text-base font-semibold tracking-tight text-white">{SITE_NAME}</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              {SITE_TAGLINE}. Browse what is trending, pick a title and press play — no account, no queue to manage.
            </p>
          </div>

          {/* The two link columns pair up below the brand on a phone; on desktop this wrapper
              dissolves (`contents`) so all three blocks sit on one line of the outer grid. */}
          <div className="grid grid-cols-2 gap-8 lg:contents">
            <nav aria-labelledby="footer-browse">
              <h2 id="footer-browse" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                Browse
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                {BROWSE.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-muted transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-labelledby="footer-apps">
              <h2 id="footer-apps" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                Apps
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <Link href="/install" className="text-muted transition-colors hover:text-white">
                    Install
                  </Link>
                </li>
              </ul>
              <p className="mt-3 max-w-[16rem] text-xs leading-relaxed text-white/50">
                Native apps for Android TV and macOS, sideloaded rather than from a store.
              </p>
            </nav>
          </div>
        </div>

        {/* The TMDB acknowledgement is the one line here that has to stay plainly readable, so
            the whole bottom bar sits at `muted` (7.8:1 on this ground) rather than the dimmer
            white/40 the rest of the fine print could have taken — that is 3.8:1, under AA. */}
        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs leading-relaxed text-muted sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <p className="max-w-2xl">
            Titles, artwork, ratings and episode data come from{" "}
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
            >
              The Movie Database (TMDB)
            </a>
            . This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
          <p className="shrink-0 sm:text-right">
            &copy; {new Date().getFullYear()} {SITE_NAME}
          </p>
        </div>
      </div>
    </footer>
  );
}
