import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(1000),
  conversationId: z.string().min(1).max(200).optional(),
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

export const generateBlogIdeasSchema = z.object({
  count: z.number().int().min(1).max(20).optional().default(5),
});

export const serpAnalysisSchema = z.object({
  keyword: z.string().min(1).max(200),
});

export const topicalMapSchema = z.object({
  mainTopic: z.string().min(1).max(300),
  siteStage: z.enum(["new", "growing", "established"]).optional().default("new"),
  clusterCount: z.number().int().min(3).max(20).optional().default(8),
});

export const metaOptimizerSchema = z.object({
  targetKeyword: z.string().min(1).max(120),
  pageTopic: z.string().min(1).max(300),
  existingTitle: z.string().max(80).nullable().optional().default(null),
  existingDescription: z.string().max(200).nullable().optional().default(null),
  brandName: z.string().max(80).nullable().optional().default(null),
});

export const pageSeoAuditSchema = z.object({
  url: z.string().url(),
  targetKeyword: z.string().min(1).max(200),
});

export const discoverPagesSchema = z.object({
  domain: z.string().min(3).max(300),
});

export const siteAuditSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(5),
  targetKeyword: z.string().min(1).max(200),
});

export const saveKeywordSchema = z.object({
  keyword: z.string().min(1).max(200),
  searchIntent: z.string().max(100).default(""),
  estimatedDifficulty: z.number().int().min(0).max(100).default(50),
  relevanceScore: z.number().min(0).max(1).default(0.5),
  searchVolumeEstimate: z.string().max(50).nullable().optional(),
  suggestedContentType: z.string().max(100).default(""),
});
