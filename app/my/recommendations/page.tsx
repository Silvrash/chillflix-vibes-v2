import type { Metadata } from "next";
import { AccountRecommendations } from "@/components/account/AccountRecommendations";
import { pageMetadata } from "@/lib/seo";

/**
 * Personal, so it is kept out of search results and the sitemap: there is
 * nothing here for a crawler, and every visitor's copy is different.
 */
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Recommended for you",
    description: "Titles TMDB suggests from the ones you have rated.",
    path: "/my/recommendations",
  }),
  robots: { index: false, follow: false },
};

export default function RecommendationsPage() {
  return <AccountRecommendations />;
}
