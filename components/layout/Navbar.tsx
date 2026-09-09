"use client";

import { AccountMenu } from "@/components/account";
import { SearchTrigger } from "@/components/search";
import { cn } from "@/lib/utils";
import { Clapperboard, Download, Film, Home, Sparkles, Tv } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/tv", label: "TV Shows", icon: Tv },
  { href: "/anime", label: "Anime", icon: Sparkles },
  { href: "/install", label: "Install", icon: Download },
];

/**
 * A floating glass pill rather than a full-width bar.
 *
 * The hero runs edge to edge underneath it, so the navigation reads as an
 * overlay on the artwork instead of a strip that steals the top of every page.
 * The blur is what keeps the labels legible while the poster behind them
 * changes.
 */
export function Navbar() {
  const pathname = usePathname();

  // `/embed` is the chrome-less player the TV app loads: the page is the
  // player and nothing else.
  if (pathname?.startsWith("/embed")) return null;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="pointer-events-auto mx-auto flex max-w-fit items-center gap-1 rounded-2xl border border-white/10 bg-black/60 p-1.5 backdrop-blur-2xl supports-[backdrop-filter]:bg-black/40 sm:gap-2">
        <Link
          href="/"
          aria-label="ChillFlixVibes home"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-dark text-white"
        >
          <Clapperboard className="h-5 w-5" />
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          {LINKS.map((link) => {
            // Match on a path boundary, not a bare prefix — otherwise a route
            // like `/tv-app` lights up "TV Shows" because it starts with `/tv`.
            const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-sm font-medium transition-colors sm:px-3.5",
                  active ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {/* Labels collapse on the narrowest screens; the icons carry it. */}
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Search is an action, not a destination, so it sits past a hairline instead of reading
            as a fifth section. At 375px every label is gone and this is one more icon in the row. */}
        <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-white/10" />
        <SearchTrigger />

        {/* Signing in is optional and always has been, so this is the last thing in the row
            rather than a section of its own — and it renders nothing at all until the session
            is known, so the pill does not resize under the pointer. */}
        <AccountMenu />
      </div>
    </header>
  );
}
