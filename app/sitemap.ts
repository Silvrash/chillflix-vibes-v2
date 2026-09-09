import type { MetadataRoute } from "next";
import { NETWORKS } from "@/lib/networks";
import { SITE_URL } from "@/lib/seo";
import { networkBrowsePath } from "@/lib/tmdb/filter-params";
import { getTrending } from "@/lib/tmdb/server";
import { MediaType, type TrendingResponse } from "@/lib/tmdb/queries";

// Regenerate daily so trending titles stay fresh in the index.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  // Every page the site wants found and can name without asking TMDB — so an outage costs the
  // titles below, never the routes themselves.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/movies`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/tv`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/anime`, lastModified, changeFrequency: "daily", priority: 0.8 },
    // The one page here that exists to be found rather than browsed: sideloading the TV app starts
    // with someone searching for it, and inside the site it is reachable from the footer alone. It
    // changes when a new APK ships, which is not weekly.
    { url: `${SITE_URL}/install`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    // The twelve network pages: each is index,follow and carries a canonical of its own (see
    // `browseMetadata`), so leaving them out left the home page's tile row as the only way a crawler
    // could learn they exist. The addresses come from the same helper those canonicals do, because a
    // listed URL that canonicalises elsewhere is an entry asking to be ignored.
    ...NETWORKS.map((network) => ({
      url: `${SITE_URL}${networkBrowsePath(network)}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];

  try {
    const [movies, tv] = await Promise.all([
      getTrending<TrendingResponse>(MediaType.movie, "week"),
      getTrending<TrendingResponse>(MediaType.tv, "week"),
    ]);
    const titles: MetadataRoute.Sitemap = [
      ...(movies.results ?? []).map((m) => ({
        url: `${SITE_URL}/media/movie/${m.id}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...(tv.results ?? []).map((t) => ({
        url: `${SITE_URL}/media/tv/${t.id}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
    return [...staticRoutes, ...titles];
  } catch {
    return staticRoutes;
  }
}
