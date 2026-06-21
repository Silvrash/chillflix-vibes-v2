"use client";

import { useEffect, useRef } from "react";
import { SearchX } from "lucide-react";
import { MediaCard } from "./MediaCard";
import { Spinner } from "@/components/ui/Spinner";
import type { Movie, TVShow } from "@/lib/tmdb/queries";

interface MediaGridProps {
  items: (Movie | TVShow)[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
}

export function MediaGrid({ items, isLoading, isFetchingNextPage, hasNextPage, onLoadMore }: MediaGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  if (!isLoading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted">
        <SearchX className="h-16 w-16" />
        <p className="text-lg">No results found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
        {items.map((item, index) => (
          <MediaCard key={`${item.id}-${index}`} item={item} />
        ))}
      </div>

      <div ref={sentinelRef} className="h-px w-full" />

      {(isLoading || isFetchingNextPage) && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
    </div>
  );
}
