import { BrowsePageServer } from "@/components/browse/BrowsePageServer";
import { tvPresets } from "@/lib/presets";
import { MediaType } from "@/lib/tmdb/queries";

export default function TvPage() {
  return <BrowsePageServer mediaType={MediaType.tv} presets={tvPresets} />;
}
