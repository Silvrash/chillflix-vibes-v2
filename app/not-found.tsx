import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/seo";

/**
 * A dead URL is not the home page, and this is the page every dead URL on the site renders.
 *
 * Left to the root layout it inherited that layout's whole set — canonical "/", the front-door card
 * and index,follow — so a mistyped or retired address unfurled in chat as the site itself, and
 * invited a crawler to file it as the site itself. The card goes rather than being restated: there
 * is nothing here to preview, and a platform with no card falls back to the title and description
 * above, which say what happened.
 */
export const metadata: Metadata = {
  title: "Page not found",
  description: `That page isn’t on ${SITE_NAME} — it may have been moved or removed.`,
  robots: { index: false, follow: true },
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
};

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 pb-16 pt-24 text-center sm:pt-28">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="max-w-md text-muted">The page you’re looking for doesn’t exist or has moved.</p>
      <Link
        href="/"
        className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90"
      >
        Back to home
      </Link>
    </div>
  );
}
