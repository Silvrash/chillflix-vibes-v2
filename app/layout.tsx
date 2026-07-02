import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Navbar } from "@/components/layout/Navbar";
import { PWARegister } from "@/components/PWARegister";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ChillFlixVibes — Stream Movies, TV & Anime",
  description: "Browse and stream trending movies, TV shows and anime. Powered by TMDB.",
  applicationName: "ChillFlixVibes",
  appleWebApp: {
    capable: true,
    title: "ChillFlixVibes",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e17",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-background font-sans text-white antialiased">
        <NuqsAdapter>
          <Providers>
            <Navbar />
            <main className="min-h-screen">{children}</main>
          </Providers>
        </NuqsAdapter>
        <PWARegister />
      </body>
    </html>
  );
}
