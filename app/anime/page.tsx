import type { Metadata } from "next";
import { BrowsePageServer } from "@/components/browse/BrowsePageServer";
import { tvPresets } from "@/lib/presets";
import { MediaType } from "@/lib/tmdb/queries";

export const metadata: Metadata = {
  title: "Anime",
  description: "Browse and stream popular and top-rated anime series.",
  alternates: { canonical: "/anime" },
};

// Filters live in the query string, so render per request (cached data layer keeps it fast).
export const dynamic = "force-dynamic";

export default function AnimePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return <BrowsePageServer mediaType={MediaType.tv} presets={tvPresets} animeOnly searchParams={searchParams} />;
}
