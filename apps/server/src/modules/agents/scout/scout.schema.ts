import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(1000),
  conversationId: z.string().min(1).max(200).optional(),
});

const depthEnum = z.enum(["quick", "standard", "deep"]);

export const researchTopicSchema = z.object({
  topic: z.string().min(1).max(300),
  depth: depthEnum.optional().default("standard"),
  sourcesHint: z.array(z.string().url()).max(10).optional().default([]),
  location: z.string().max(200).optional().default(""),
});

export const researchCompanySchema = z.object({
  companyName: z.string().min(1).max(120),
  // Empty string is a common "no URL known" signal from the client — normalize to null
  // before validating so it never trips .url().
  companyUrl: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().url().nullable().optional().default(null)
  ),
});

export const trendingTopicsSchema = z.object({
  industry: z.string().min(1).max(120),
  count: z.number().int().min(1).max(50).optional().default(10),
  location: z.string().max(200).optional().default(""),
});

export const discoverCompetitorsSchema = z.object({
  description: z.string().min(1).max(300),
  industry: z.string().min(1).max(120),
  count: z.number().int().min(1).max(20).optional().default(8),
  location: z.string().max(200).optional().default(""),
});
