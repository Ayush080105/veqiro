import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_LANDING_URL || "https://veqiro.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
