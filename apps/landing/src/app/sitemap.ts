import type { MetadataRoute } from "next";
import { getAllPostMetas } from "@/lib/blog";

const SITE_URL =
  process.env.NEXT_PUBLIC_LANDING_URL || "https://veqiro.com";

const AGENT_SLUGS = ['vega', 'scout', 'maya', 'sage', 'lex', 'rex'];

const USE_CASE_SLUGS = ['founders', 'marketing-teams', 'agencies', 'growing-startups'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPostMetas();
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...AGENT_SLUGS.map(slug => ({
      url: `${SITE_URL}/agents/${slug}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    {
      url: `${SITE_URL}/use-cases`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    ...USE_CASE_SLUGS.map(slug => ({
      url: `${SITE_URL}/use-cases/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/blog`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    ...posts.map(post => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedDate ?? post.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
