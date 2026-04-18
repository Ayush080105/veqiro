import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const keywordResearchSchema = z.object({
  seedTopic: z.string().min(1).max(200),
  niche: z.string().max(100).optional().default(""),
  competitorUrls: z.array(z.string().url()).max(20).optional().default([]),
  count: z.number().int().min(1).max(100).optional().default(20),
});

const blogOutputFormat = z.enum(["markdown", "html", "wordpress", "wix"]);

export const generateBlogSchema = z.object({
  topic: z.string().min(1).max(300),
  targetKeyword: z.string().min(1).max(120),
  secondaryKeywords: z.array(z.string()).max(20).optional().default([]),
  wordCount: z.number().int().min(200).max(10000).optional().default(2000),
  outputFormat: blogOutputFormat.optional().default("markdown"),
  includeMeta: z.boolean().optional().default(true),
  includeSchemaMarkup: z.boolean().optional().default(false),
  toneOverride: z.string().max(200).nullable().optional().default(null),
});

export const analyzeContentSchema = z.object({
  content: z.string().max(30000),
  targetKeyword: z.string().max(120),
  url: z.string().url().nullable().optional().default(null),
});

export const contentBriefSchema = z.object({
  topic: z.string().min(1).max(300),
  targetKeyword: z.string().min(1).max(120),
  competitorUrls: z.array(z.string().url()).max(20).optional().default([]),
});
