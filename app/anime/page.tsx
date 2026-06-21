import { BrowsePageServer } from "@/components/browse/BrowsePageServer";
import { tvPresets } from "@/lib/presets";
import { MediaType } from "@/lib/tmdb/queries";

export default function AnimePage() {
  return <BrowsePageServer mediaType={MediaType.tv} presets={tvPresets} animeOnly />;
}
