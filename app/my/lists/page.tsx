import type { Metadata } from "next";
import { AccountLists } from "@/components/account/AccountLists";
import { pageMetadata } from "@/lib/seo";

/**
 * Personal, so it is kept out of search results and the sitemap: there is
 * nothing here for a crawler, and every visitor's copy is different.
 */
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Your lists",
    description: "Custom lists you keep on your TMDB account.",
    path: "/my/lists",
  }),
  robots: { index: false, follow: false },
};

export default function ListsPage() {
  return <AccountLists />;
}
