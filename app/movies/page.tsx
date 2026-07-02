import type { Metadata } from "next";
import { BrowsePageServer } from "@/components/browse/BrowsePageServer";
import { moviePresets } from "@/lib/presets";
import { MediaType } from "@/lib/tmdb/queries";

export const metadata: Metadata = {
  title: "Movies",
  description: "Browse and stream trending, popular and top-rated movies.",
  alternates: { canonical: "/movies" },
};

// Filters live in the query string, so render per request (cached data layer keeps it fast).
export const dynamic = "force-dynamic";

export default function MoviesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return <BrowsePageServer mediaType={MediaType.movie} presets={moviePresets} searchParams={searchParams} />;
}
