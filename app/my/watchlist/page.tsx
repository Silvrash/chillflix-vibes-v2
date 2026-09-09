import type { Metadata } from "next";
import { AccountLibrary } from "@/components/account/AccountLibrary";
import { pageMetadata } from "@/lib/seo";

/**
 * Personal, so it is kept out of search results and the sitemap: there is
 * nothing here for a crawler, and every visitor's copy is different.
 */
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Your watchlist",
    description: "Titles you have saved to your TMDB watchlist.",
    path: "/my/watchlist",
  }),
  robots: { index: false, follow: false },
};

export default function WatchlistPage() {
  return <AccountLibrary kind="watchlist" />;
}
