import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountListDetail } from "@/components/account/AccountListDetail";
import { pageMetadata } from "@/lib/seo";

/**
 * Personal, so it is kept out of search results and the sitemap: there is
 * nothing here for a crawler, and every visitor's copy is different.
 *
 * The list's own name cannot go in the title — it is behind the viewer's
 * credentials, and this page is rendered before anyone is known.
 */
export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return {
    ...pageMetadata({
      title: "Your list",
      description: "A custom list you keep on your TMDB account.",
      path: `/my/lists/${params.id}`,
    }),
    robots: { index: false, follow: false },
  };
}

export default function ListPage({ params }: { params: { id: string } }) {
  const listId = Number(params.id);
  // TMDB list ids are integers; anything else could only ever 400 upstream.
  if (!Number.isInteger(listId) || listId <= 0) notFound();

  return <AccountListDetail listId={listId} />;
}
