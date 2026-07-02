import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { getTrending } from "@/lib/tmdb/server";
import { MediaType, type TrendingResponse } from "@/lib/tmdb/queries";

// Regenerate daily so trending titles stay fresh in the index.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/movies`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/tv`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/anime`, lastModified, changeFrequency: "daily", priority: 0.8 },
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
