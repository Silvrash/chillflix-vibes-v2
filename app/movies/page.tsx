import { BrowsePageServer } from "@/components/browse/BrowsePageServer";
import { moviePresets } from "@/lib/presets";
import { MediaType } from "@/lib/tmdb/queries";

export default function MoviesPage() {
  return <BrowsePageServer mediaType={MediaType.movie} presets={moviePresets} />;
}
