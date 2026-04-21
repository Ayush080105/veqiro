import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_LANDING_URL || "https://veqiro.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
