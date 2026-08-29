import { z } from "zod";
import { MAX_VIDEO_SECONDS, VIDEO_SEGMENT_SECONDS } from "./maya.quotas.js";

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

// Omni renders 10s per call and extends in 10s steps to a hard 40s ceiling.
const videoDurationSchema = z
  .number()
  .int()
  .min(VIDEO_SEGMENT_SECONDS)
  .max(MAX_VIDEO_SECONDS)
  .multipleOf(VIDEO_SEGMENT_SECONDS)
  .optional()
  .default(VIDEO_SEGMENT_SECONDS);

export const generateVideoSchema = z.object({
  prompt: z.string().min(1).max(2000),
  platform: platformEnum.default("instagram"),
  aspectRatio: videoAspectRatioEnum.default("9:16"),
  durationSeconds: videoDurationSchema,
  useLogo: z.boolean().optional().default(false),
});

export const campaignVideoSchema = z.object({
  productImageUrls: z.array(z.string().url()).min(1).max(5),
  campaignBrief: z.string().min(1).max(5000),
  platform: platformEnum.default("instagram"),
  aspectRatio: videoAspectRatioEnum.default("9:16"),
  durationSeconds: videoDurationSchema,
  useLogo: z.boolean().optional().default(false),
  // 9 beats and one 3x3 storyboard sheet per 10-second segment.
  storyboardBeats: z
    .array(z.string())
    .max(9 * (MAX_VIDEO_SECONDS / VIDEO_SEGMENT_SECONDS))
    .optional(),
  storyboardImageUrls: z
    .array(z.string().url())
    .max(MAX_VIDEO_SECONDS / VIDEO_SEGMENT_SECONDS)
    .optional(),
  // A plan already returned by /campaign-video/plan and shown to the user; skips re-planning.
  segmentNarratives: z
    .array(z.string().max(8000))
    .max(MAX_VIDEO_SECONDS / VIDEO_SEGMENT_SECONDS)
    .optional(),
});

export const campaignVideoPlanSchema = z.object({
  productImageUrls: z.array(z.string().url()).min(1).max(5),
  campaignBrief: z.string().min(1).max(5000),
  platform: platformEnum.default("instagram"),
  aspectRatio: videoAspectRatioEnum.default("9:16"),
  durationSeconds: videoDurationSchema,
});

export const campaignVideoStoryboardSchema = z.object({
  productImageUrls: z.array(z.string().url()).min(1).max(5),
  campaignBrief: z.string().min(1).max(5000),
  platform: platformEnum.default("instagram"),
  aspectRatio: videoAspectRatioEnum.default("9:16"),
  durationSeconds: videoDurationSchema,
  useLogo: z.boolean().optional().default(false),
});

export const logoAnimationSchema = z
  .object({
    styleId: z.number().int().min(1).max(102),
    platform: platformEnum.default("instagram"),
    aspectRatio: videoAspectRatioEnum.default("9:16"),
    logoImageUrl: z.string().url().optional(),
    useBrandLogo: z.boolean().optional().default(false),
  })
  .refine(
    (v) => Boolean(v.logoImageUrl || v.useBrandLogo),
    "Upload a logo or enable useBrandLogo"
  );

// Instagram publishes over its Composio MCP connection, which has no
// SocialAccount row — so callers send `platform: "instagram"` instead of a
// socialAccountId. Exactly one of the two identifies the target.
const publishTarget = {
  socialAccountId: z.string().min(1).optional(),
  platform: z.enum(["instagram"]).optional(),
};

const hasExactlyOneTarget = (v: { socialAccountId?: string; platform?: string }) =>
  Boolean(v.socialAccountId) !== Boolean(v.platform);

const ONE_TARGET_MESSAGE = "Provide either socialAccountId or platform, not both";

export const publishSchema = z
  .object({
    ...publishTarget,
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
  .refine(hasExactlyOneTarget, ONE_TARGET_MESSAGE);

export const publishCarouselSchema = z
  .object({
    ...publishTarget,
    caption: z.string().max(2200).optional().default(""),
    hashtags: z.array(z.string()).max(30).optional().default([]),
    imageUrls: z.array(z.string().url()).min(1).max(10),
  })
  .refine(hasExactlyOneTarget, ONE_TARGET_MESSAGE);

const futureDatetime = z.string().datetime().refine(
  (v) => new Date(v).getTime() > Date.now(),
  "scheduledAt must be in the future"
);

export const scheduleSchema = z
  .object({
    ...publishTarget,
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
  .refine(hasExactlyOneTarget, ONE_TARGET_MESSAGE);

export const scheduleCarouselSchema = z
  .object({
    ...publishTarget,
    caption: z.string().max(2200).optional().default(""),
    hashtags: z.array(z.string()).max(30).optional().default([]),
    imageUrls: z.array(z.string().url()).min(1).max(10),
    scheduledAt: futureDatetime,
  })
  .refine(hasExactlyOneTarget, ONE_TARGET_MESSAGE);
