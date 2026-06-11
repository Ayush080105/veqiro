import { z } from "zod";

const platformEnum = z.enum(["linkedin", "twitter", "instagram"]);

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  conversationId: z.string().min(1).max(200).optional(),
});

export const generateIdeasSchema = z.object({
  platform: platformEnum.default("linkedin"),
  topic_hint: z.string().max(500).optional().default(""),
  count: z.number().int().min(1).max(10).optional().default(3),
  include_image: z.boolean().optional().default(false),
  use_logo: z.boolean().optional().default(false),
  use_mascot: z.boolean().optional().default(false),
  use_brandkit: z.boolean().optional().default(false),
});

export const draftContentSchema = z.object({
  topic: z.string().min(1).max(500),
  platform: platformEnum.default("linkedin"),
  tone_override: z.string().max(100).nullable().optional(),
  word_count_target: z.number().int().min(20).max(2000).optional().default(200),
  include_image: z.boolean().optional().default(false),
  use_logo: z.boolean().optional().default(false),
  use_mascot: z.boolean().optional().default(false),
  additional_context: z.string().max(1000).nullable().optional(),
  from_rex: z.boolean().optional().default(false),
  inspiration_images: z.array(z.string().url()).max(5).optional().default([]),
  brand_image_ids: z.array(z.string().uuid()).max(20).optional().default([]),
  brand_image_prompts: z.record(z.string().uuid(), z.string().max(1000)).optional().default({}),
});

export const generateVariantsSchema = z.object({
  original_content: z.string().min(1).max(5000),
  original_platform: platformEnum.catch("linkedin"),
  target_platforms: z.array(platformEnum).min(1).max(3),
  include_images: z.boolean().optional().default(false),
});

export const reviseSchema = z.object({
  original_content: z.string().min(1).max(5000),
  platform: platformEnum.default("linkedin"),
  feedback: z.string().min(1).max(1000),
  specific_instructions: z.string().max(500).nullable().optional(),
});

export const regenerateImageSchema = z.object({
  image_url: z.string().url(),
  prompt: z.string().min(1).max(1000),
  use_logo: z.boolean().optional().default(false),
  use_mascot: z.boolean().optional().default(false),
});

export const regenerateContentSchema = z.object({
  caption: z.string().min(1).max(5000),
  prompt: z.string().min(1).max(1000),
  platform: platformEnum.default("linkedin"),
});

export const draftCarouselSchema = z.object({
  topic: z.string().min(1).max(500),
  platform: platformEnum.default("linkedin"),
  carousel_count: z.number().int().min(2).max(8).optional().default(3),
  tone_override: z.string().max(100).nullable().optional(),
  include_images: z.boolean().optional().default(true),
  use_logo: z.boolean().optional().default(false),
  use_mascot: z.boolean().optional().default(false),
  additional_context: z.string().max(1000).nullable().optional(),
  image_aspect_ratio: z.enum(["1:1", "16:9", "9:16", "4:3"]).optional().default("1:1"),
});

export const expandBriefSchema = z.object({
  brief: z.string().min(1).max(500),
  platform: platformEnum.default("instagram"),
  product_image_base64: z.string().optional(),
});

export const campaignSchema = z.object({
  product_image_url: z.string().url(),
  campaign_brief: z.string().min(1).max(5000),
  photo_count: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)]).default(4),
  use_logo: z.boolean().default(true),
  use_mascot: z.boolean().default(true),
  platform: platformEnum.default("instagram"),
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

export const publishCarouselSchema = z.object({
  socialAccountId: z.string().min(1),
  caption: z.string().max(2200).optional().default(""),
  hashtags: z.array(z.string()).max(30).optional().default([]),
  imageUrls: z.array(z.string().url()).min(1).max(10),
});
