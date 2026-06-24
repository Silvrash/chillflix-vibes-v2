import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Navbar } from "@/components/layout/Navbar";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ChillFlixVibes — Stream Movies, TV & Anime",
  description: "Browse and stream trending movies, TV shows and anime. Powered by TMDB.",
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
      </body>
    </html>
  );
}
