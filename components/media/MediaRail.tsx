"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MediaCard } from "./MediaCard";
import type { Cast, Crew, Movie, TVShow } from "@/lib/tmdb/queries";

interface MediaRailProps {
  title: string;
  items: (Movie | TVShow | Cast | Crew)[];
  onEndReached?: () => void;
}

export function MediaRail({ title, items, onEndReached }: MediaRailProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (!items.length) return null;

  function scrollBy(direction: 1 | -1) {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth * 0.8, behavior: "smooth" });
  }

  function handleScroll() {
    const node = scrollerRef.current;
    if (!node || !onEndReached) return;
    if (node.scrollLeft + node.clientWidth >= node.scrollWidth - 400) {
      onEndReached();
    }
  }

  return (
    <section className="group/rail relative">
      <h2 className="mb-3 text-xl font-bold">{title}</h2>

      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label="Scroll left"
        className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/70 p-2 opacity-0 transition-opacity hover:bg-black group-hover/rail:opacity-100 md:block"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth pb-2 sm:gap-4"
      >
        {items.map((item, index) => (
          <div key={`${item.id}-${index}`} className="w-28 shrink-0 sm:w-32 md:w-36">
            <MediaCard item={item} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label="Scroll right"
        className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/70 p-2 opacity-0 transition-opacity hover:bg-black group-hover/rail:opacity-100 md:block"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </section>
  );
}
