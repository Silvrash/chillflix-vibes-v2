import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { HomeRails } from "@/components/home/HomeRails";
import { makeQueryClient } from "@/lib/tmdb/query-client";
import { getTrending } from "@/lib/tmdb/server";
import { GetTrendingMoviesQueryKey, GetTrendingTVShowsQueryKey, MediaType, type TrendingResponse } from "@/lib/tmdb/queries";

// The home renders its own page rather than redirecting to /movies. A redirect returns no HTML,
// so link previews (Open Graph) got no title/description/logo when the bare root URL was shared.
// Metadata comes from the root layout defaults (site title + og.png banner).
//
// Rendering per request also keeps the build honest: `next build` runs without a TMDB token, and
// prerendering would bake today's empty prefetch into the image.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const queryClient = makeQueryClient();

  // The hero and both Top 10 rails read these two entries, so one pair of (cached) fetches puts
  // the whole first screenful in the HTML. The discover rails below the fold fetch themselves.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: [GetTrendingMoviesQueryKey, { time_window: "day" }],
      queryFn: () => getTrending<TrendingResponse>(MediaType.movie, "day"),
    }),
    queryClient.prefetchQuery({
      queryKey: [GetTrendingTVShowsQueryKey, { time_window: "day" }],
      queryFn: () => getTrending<TrendingResponse>(MediaType.tv, "day"),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeRails />
    </HydrationBoundary>
  );
}
