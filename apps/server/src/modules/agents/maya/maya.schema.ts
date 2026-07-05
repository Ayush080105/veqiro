import { z } from "zod";

const platformEnum = z.enum(["linkedin", "twitter", "instagram"]);

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  conversationId: z.string().min(1).max(200).optional(),
});

export const generateIdeasSchema = z.object({
  platform: platformEnum.default("linkedin"),
  topicHint: z.string().max(500).optional().default(""),
  count: z.number().int().min(1).max(10).optional().default(3),
  includeImage: z.boolean().optional().default(false),
  useLogo: z.boolean().optional().default(false),
  useMascot: z.boolean().optional().default(false),
  useBrandkit: z.boolean().optional().default(false),
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
  fromRex: z.boolean().optional().default(false),
  inspirationImages: z.array(z.string().url()).max(5).optional().default([]),
  brandImageIds: z.array(z.string().uuid()).max(20).optional().default([]),
  brandImagePrompts: z.record(z.string().uuid(), z.string().max(1000)).optional().default({}),
});

export const generateVariantsSchema = z.object({
  originalContent: z.string().min(1).max(5000),
  originalPlatform: platformEnum.catch("linkedin"),
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
  useLogo: z.boolean().optional().default(false),
  useMascot: z.boolean().optional().default(false),
});

export const regenerateContentSchema = z.object({
  caption: z.string().min(1).max(5000),
  prompt: z.string().min(1).max(1000),
  platform: platformEnum.default("linkedin"),
});

export const draftCarouselSchema = z.object({
  topic: z.string().min(1).max(500),
  platform: platformEnum.default("linkedin"),
  carouselCount: z.number().int().min(2).max(8).optional().default(3),
  toneOverride: z.string().max(100).nullable().optional(),
  includeImages: z.boolean().optional().default(true),
  useLogo: z.boolean().optional().default(false),
  useMascot: z.boolean().optional().default(false),
  additionalContext: z.string().max(1000).nullable().optional(),
  imageAspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3"]).optional().default("1:1"),
});

export const expandBriefSchema = z.object({
  brief: z.string().min(1).max(500),
  platform: platformEnum.default("instagram"),
  productImageBase64: z.string().optional(),
  productImageUrl: z.string().url().optional(),
});

export const campaignSchema = z.object({
  productImageUrls: z.array(z.string().url()).min(1).max(5),
  campaignBrief: z.string().min(1).max(5000),
  photoCount: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)]).default(4),
  useLogo: z.boolean().default(true),
  useMascot: z.boolean().default(true),
  platform: platformEnum.default("instagram"),
});

const videoAspectRatioEnum = z.enum(["16:9", "9:16"]);

export const generateVideoSchema = z.object({
  prompt: z.string().min(1).max(2000),
  platform: platformEnum.default("instagram"),
  aspectRatio: videoAspectRatioEnum.default("9:16"),
  durationSeconds: z.number().int().min(4).max(10).optional().default(8),
  useLogo: z.boolean().optional().default(false),
});

export const campaignVideoSchema = z.object({
  productImageUrls: z.array(z.string().url()).min(1).max(5),
  campaignBrief: z.string().min(1).max(5000),
  platform: platformEnum.default("instagram"),
  aspectRatio: videoAspectRatioEnum.default("9:16"),
  durationSeconds: z.number().int().min(4).max(10).optional().default(8),
  useLogo: z.boolean().optional().default(false),
  storyboardBeats: z.array(z.string()).max(4).optional(),
  storyboardImageUrl: z.string().url().optional(),
});

export const campaignVideoStoryboardSchema = z.object({
  productImageUrls: z.array(z.string().url()).min(1).max(5),
  campaignBrief: z.string().min(1).max(5000),
  platform: platformEnum.default("instagram"),
  aspectRatio: videoAspectRatioEnum.default("9:16"),
  durationSeconds: z.number().int().min(4).max(10).optional().default(8),
  useLogo: z.boolean().optional().default(false),
});

export const publishSchema = z
  .object({
    socialAccountId: z.string().min(1),
    caption: z.string().min(1).max(5000),
    hashtags: z.array(z.string()).max(30).optional().default([]),
    imageUrl: z.string().url().optional(),
    imageBase64: z.string().optional(),
    videoUrl: z.string().url().optional(),
    videoBase64: z.string().optional(),
    postType: z.enum(["post", "reel"]).optional(),
  })
  .refine(
    (v) => !(v.imageBase64 && v.imageUrl),
    "Provide either imageUrl or imageBase64, not both"
  )
  .refine(
    (v) => !(v.videoBase64 && v.videoUrl),
    "Provide either videoUrl or videoBase64, not both"
  )
  .refine(
    (v) => !((v.imageUrl || v.imageBase64) && (v.videoUrl || v.videoBase64)),
    "Provide either an image or a video, not both"
  )
  .refine(
    (v) => Boolean(v.imageUrl || v.imageBase64 || v.videoUrl || v.videoBase64),
    "Provide an image or a video to publish"
  );

export const publishCarouselSchema = z.object({
  socialAccountId: z.string().min(1),
  caption: z.string().max(2200).optional().default(""),
  hashtags: z.array(z.string()).max(30).optional().default([]),
  imageUrls: z.array(z.string().url()).min(1).max(10),
});

const futureDatetime = z.string().datetime().refine(
  (v) => new Date(v).getTime() > Date.now(),
  "scheduledAt must be in the future"
);

export const scheduleSchema = z
  .object({
    socialAccountId: z.string().min(1),
    caption: z.string().min(1).max(5000),
    hashtags: z.array(z.string()).max(30).optional().default([]),
    imageUrl: z.string().url().optional(),
    imageBase64: z.string().optional(),
    videoUrl: z.string().url().optional(),
    videoBase64: z.string().optional(),
    postType: z.enum(["post", "reel"]).optional(),
    scheduledAt: futureDatetime,
  })
  .refine(
    (v) => !(v.imageBase64 && v.imageUrl),
    "Provide either imageUrl or imageBase64, not both"
  )
  .refine(
    (v) => !(v.videoBase64 && v.videoUrl),
    "Provide either videoUrl or videoBase64, not both"
  )
  .refine(
    (v) => !((v.imageUrl || v.imageBase64) && (v.videoUrl || v.videoBase64)),
    "Provide either an image or a video, not both"
  )
  .refine(
    (v) => Boolean(v.imageUrl || v.imageBase64 || v.videoUrl || v.videoBase64),
    "Provide an image or a video to schedule"
  );

export const scheduleCarouselSchema = z.object({
  socialAccountId: z.string().min(1),
  caption: z.string().max(2200).optional().default(""),
  hashtags: z.array(z.string()).max(30).optional().default([]),
  imageUrls: z.array(z.string().url()).min(1).max(10),
  scheduledAt: futureDatetime,
});
