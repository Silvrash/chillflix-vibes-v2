import { BrowsePageServer } from "@/components/browse/BrowsePageServer";
import { tvPresets } from "@/lib/presets";
import { MediaType } from "@/lib/tmdb/queries";

// Filters live in the query string, so render per request (cached data layer keeps it fast).
export const dynamic = "force-dynamic";

export default function TvPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return <BrowsePageServer mediaType={MediaType.tv} presets={tvPresets} searchParams={searchParams} />;
}
