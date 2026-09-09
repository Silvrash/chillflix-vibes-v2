import type { Metadata } from "next";
import { AccountLibrary } from "@/components/account/AccountLibrary";
import { pageMetadata } from "@/lib/seo";

/**
 * Personal, so it is kept out of search results and the sitemap: there is
 * nothing here for a crawler, and every visitor's copy is different.
 */
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Your ratings",
    description: "Titles you have rated on TMDB.",
    path: "/my/ratings",
  }),
  robots: { index: false, follow: false },
};

export default function RatingsPage() {
  return <AccountLibrary kind="ratings" />;
}
