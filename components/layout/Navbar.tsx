"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/movies", label: "Movies" },
  { href: "/tv", label: "TV Shows" },
  { href: "/anime", label: "Anime" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-8 px-4 sm:px-6 lg:px-10">
        <Link href="/movies" className="flex shrink-0 items-center gap-2">
          <Clapperboard className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight">
            Chill<span className="text-primary">Flix</span>Vibes
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:px-4",
                  active ? "bg-white/10 text-white" : "text-muted hover:text-white",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
