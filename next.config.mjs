/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep the client-side Router Cache (RSC payloads) warm so back/forward and
    // revisits are instant instead of refetching.
    staleTimes: { dynamic: 30, static: 300 },
  },
  // /tv-app became /install when the page grew past the television. Anything
  // already shared — a link, a QR code, an address typed into a TV once — has
  // to keep landing somewhere.
  async redirects() {
    return [{ source: "/tv-app", destination: "/install", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The global `nosniff` above means the APK has to be typed correctly or
        // the browser refuses it; `attachment` stops Android TV browsers trying
        // to render it instead of handing it to the package installer.
        source: "/chillflixvibes-tv.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: "attachment; filename=chillflixvibes-tv.apk" },
        ],
      },
      {
        // Never cache the service worker, so a new version is picked up instantly.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
