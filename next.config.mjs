/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep the client-side Router Cache (RSC payloads) warm so back/forward and
    // revisits are instant instead of refetching.
    staleTimes: { dynamic: 30, static: 300 },
  },
  images: {
    // TMDB image files are immutable, so let the optimizer cache them for a year.
    minimumCacheTTL: 31536000,
    formats: ["image/avif", "image/webp"],
    // Cap the largest generated variants (drop 2048/3840) — keeps hero backdrops
    // sharp up to 1080p screens while avoiding multi-MB images on huge displays.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
};

export default nextConfig;
