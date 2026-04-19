import { z } from "zod";

const platformEnum = z.enum(["linkedin", "twitter", "instagram"]);

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const generateIdeasSchema = z.object({
  platform: platformEnum.default("linkedin"),
  topicHint: z.string().max(500).optional().default(""),
  count: z.number().int().min(1).max(10).optional().default(3),
  includeImage: z.boolean().optional().default(false),
  useLogo: z.boolean().optional().default(false),
  useMascot: z.boolean().optional().default(false),
});

export const draftContentSchema = z.object({
  topic: z.string().min(1).max(500),
  platform: platformEnum.default("linkedin"),
  toneOverride: z.string().max(100).nullable().optional(),
  wordCountTarget: z.number().int().min(20).max(2000).optional().default(200),
  includeImage: z.boolean().optional().default(false),
  useLogo: z.boolean().optional().default(false),
  useMascot: z.boolean().optional().default(false),
  additionalContext: z.string().max(1000).nullable().optional(),
});

export const generateVariantsSchema = z.object({
  originalContent: z.string().min(1).max(5000),
  originalPlatform: platformEnum.default("linkedin"),
  targetPlatforms: z.array(platformEnum).min(1).max(3),
  includeImages: z.boolean().optional().default(false),
});

export const reviseSchema = z.object({
  originalContent: z.string().min(1).max(5000),
  platform: platformEnum.default("linkedin"),
  feedback: z.string().min(1).max(1000),
  specificInstructions: z.string().max(500).nullable().optional(),
});

export const regenerateImageSchema = z.object({
  imageUrl: z.string().url(),
  prompt: z.string().min(1).max(1000),
  platform: platformEnum.default("instagram"),
  useLogo: z.boolean().optional().default(false),
  useMascot: z.boolean().optional().default(false),
});

export const regenerateContentSchema = z.object({
  caption: z.string().min(1).max(5000),
  prompt: z.string().min(1).max(1000),
  platform: platformEnum.default("linkedin"),
});

export const publishSchema = z
  .object({
    socialAccountId: z.string().min(1),
    caption: z.string().min(1).max(5000),
    hashtags: z.array(z.string()).max(30).optional().default([]),
    imageUrl: z.string().url().optional(),
    imageBase64: z.string().optional(),
  })
  .refine(
    (v) => !(v.imageBase64 && v.imageUrl),
    "Provide either imageUrl or imageBase64, not both"
  );
