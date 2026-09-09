import type { Metadata } from "next";
import { BrowsePageServer } from "@/components/browse/BrowsePageServer";
import { moviePresets } from "@/lib/presets";
import { browseMetadata } from "@/lib/tmdb/filter-params";
import { MediaType } from "@/lib/tmdb/queries";

export function generateMetadata({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Metadata {
  return browseMetadata({
    searchParams,
    section: "Movies",
    mediaType: MediaType.movie,
    path: "/movies",
    description: "Browse and stream trending, popular and top-rated movies.",
  });
}

// Filters live in the query string, so render per request (cached data layer keeps it fast).
export const dynamic = "force-dynamic";

export default function MoviesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return <BrowsePageServer mediaType={MediaType.movie} presets={moviePresets} searchParams={searchParams} />;
}
