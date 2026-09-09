import type { MetadataRoute } from "next";
import { SITE_HOST, SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    // Absolute, as the sitemap directive is specified: it is a URL to fetch, not a path to resolve.
    sitemap: `${SITE_URL}/sitemap.xml`,
    // Bare host, as the Host directive is specified — no scheme, which is why SITE_HOST exists. The
    // one crawler that still reads Host (Yandex) drops a value it cannot parse, so a URL here is
    // not a harmlessly verbose hint: it is the mirror hint silently not being given at all.
    host: SITE_HOST,
  };
}
