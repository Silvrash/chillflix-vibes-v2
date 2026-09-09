import type { Metadata } from "next";
import { AccountLibrary } from "@/components/account/AccountLibrary";
import { pageMetadata } from "@/lib/seo";

/**
 * Personal, so it is kept out of search results and the sitemap: there is
 * nothing here for a crawler, and every visitor's copy is different.
 */
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Your favourites",
    description: "Titles you have marked as favourites on TMDB.",
    path: "/my/favorites",
  }),
  robots: { index: false, follow: false },
};

export default function FavoritesPage() {
  return <AccountLibrary kind="favorites" />;
}
