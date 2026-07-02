import { BrowsePageServer } from "@/components/browse/BrowsePageServer";
import { moviePresets } from "@/lib/presets";
import { MediaType } from "@/lib/tmdb/queries";

// The home renders the movies browse directly rather than redirecting to
// /movies. A redirect returns no HTML, so link previews (Open Graph) got no
// title/description/logo when the bare root URL was shared. Metadata comes from
// the root layout defaults (site title + og.png banner).
export const dynamic = "force-dynamic";

export default function HomePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return <BrowsePageServer mediaType={MediaType.movie} presets={moviePresets} searchParams={searchParams} />;
}
