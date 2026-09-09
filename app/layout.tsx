import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PWARegister } from "@/components/PWARegister";
import { TVMode } from "@/components/TVMode";
import { SITE_DESCRIPTION, SITE_NAME, SITE_OG_IMAGE, SITE_TAGLINE, SITE_URL } from "@/lib/seo";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["movies", "tv shows", "anime", "streaming", "watch online", "free movies", SITE_NAME],
  // The canonical and the card below it are the home page's own, and sit at this level only because
  // a layout is where Next lets a page inherit them. Inheritance is the trap: a route that names
  // just a title keeps this canonical and this whole card, so it unfurls as the front door and
  // tells crawlers it *is* the front door. So give any page worth sharing or indexing its own, in
  // one piece — `pageMetadata` in lib/seo.ts writes the set — since Next replaces each of these
  // keys whole rather than merging the fields inside it.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    images: [{ url: SITE_OG_IMAGE, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      {/* Column layout so the footer is pinned below a short page instead of floating
          mid-screen — `min-h-screen` on <main> would instead guarantee a scrollbar on
          every page, since the footer always adds height beyond the viewport. */}
      <body className="flex min-h-screen flex-col bg-background font-sans text-white antialiased">
        <NuqsAdapter>
          <Providers>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </Providers>
        </NuqsAdapter>
        <PWARegister />
        <TVMode />
      </body>
    </html>
  );
}
