"use client";

import { useEffect, useRef } from "react";
import { SearchX } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { MediaCard, type MediaCardItem } from "./MediaCard";

export interface MediaGridProps {
  items: MediaCardItem[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  /** Headline shown when there is nothing to render. */
  emptyLabel?: string;
  className?: string;
}

export function MediaGrid({
  items,
  isLoading = false,
  isFetchingNextPage = false,
  hasNextPage = false,
  onLoadMore,
  emptyLabel = "No results found",
  className,
}: MediaGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !onLoadMore) return;

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
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <SearchX className="h-12 w-12 text-muted" />
        <p className="text-lg font-semibold text-white">{emptyLabel}</p>
        <p className="text-sm text-muted">Try a different search, or loosen the filters.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* `tv-grid` lets globals.css swap in size-based columns for the couch; it only wins over
          grid-cols-* while those stay plain utilities, so no arbitrary grid-template values here. */}
      <div className="tv-grid grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
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
