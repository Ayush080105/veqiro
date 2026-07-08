import { z } from "zod"

export const CONTENT_PLATFORMS = ["linkedin", "twitter", "instagram"] as const
export const platformSchema = z.enum(CONTENT_PLATFORMS)

export const mayaIdeationSchema = z.object({
  platform: platformSchema,
  topic_hint: z.string().optional(),
  count: z.number().int().min(1).max(10).optional(),
  use_brandkit: z.boolean().optional(),
})
export type MayaIdeationValues = z.infer<typeof mayaIdeationSchema>

export const mayaDraftSchema = z.object({
  topic: z.string().min(3, "Topic is required"),
  platforms: z.array(platformSchema).min(1).max(3),
  tone_override: z.string().optional(),
  word_count_target: z.number().int().min(20).max(2000).optional(),
  include_image: z.boolean().optional(),
  use_logo: z.boolean().optional(),
  use_mascot: z.boolean().optional(),
  use_brand_colors: z.boolean().optional(),
  additional_context: z.string().optional(),
  from_rex: z.boolean().optional(),
  inspiration_images: z.array(z.string().url()).max(5).optional(),
  make_carousel: z.boolean().optional(),
  carousel_count: z.number().int().min(2).max(8).optional(),
  brand_image_ids: z.array(z.string()).max(20).optional(),
  brand_image_prompts: z.record(z.string(), z.string().max(1000)).optional(),
})
export type MayaDraftValues = z.infer<typeof mayaDraftSchema>

export const mayaVariantsSchema = z.object({
  original_content: z.string().min(1, "Original content is required"),
  original_platform: platformSchema,
  target_platforms: z
    .array(platformSchema)
    .min(1, "Pick at least one target platform"),
  include_images: z.boolean().optional(),
})
export type MayaVariantsValues = z.infer<typeof mayaVariantsSchema>

export const mayaReviseSchema = z.object({
  original_content: z.string().min(1, "Original content is required"),
  platform: platformSchema,
  feedback: z.string().min(3, "Tell Maya what to change"),
  specific_instructions: z.string().optional(),
})
export type MayaReviseValues = z.infer<typeof mayaReviseSchema>

export const mayaImageRegenSchema = z.object({
  image_url: z.string().optional(),
  prompt: z.string().min(3, "Describe the image"),
  platform: platformSchema.optional(),
  use_logo: z.boolean().optional(),
  use_mascot: z.boolean().optional(),
})
export type MayaImageRegenValues = z.infer<typeof mayaImageRegenSchema>

export const mayaContentRegenSchema = z.object({
  caption: z.string().min(1, "Existing caption is required"),
  prompt: z.string().min(3, "Describe the rewrite"),
  platform: platformSchema,
})
export type MayaContentRegenValues = z.infer<typeof mayaContentRegenSchema>

export const mayaPublishSchema = z.object({
  platform: platformSchema,
  account_id: z.string().min(1, "Pick an account"),
  caption: z.string().min(1, "Caption is required"),
  image_url: z.string().optional(),
})
export type MayaPublishValues = z.infer<typeof mayaPublishSchema>

export const mayaCampaignSchema = z.object({
  product_image_urls: z.array(z.string().url()).min(1, "Upload at least one product image").max(5),
  campaign_brief: z.string().min(1, "Campaign brief is required").max(5000),
  photo_count: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)]),
  use_logo: z.boolean(),
  use_mascot: z.boolean(),
  use_brand_colors: z.boolean(),
  platform: platformSchema,
})
export type MayaCampaignValues = z.infer<typeof mayaCampaignSchema>

export const videoAspectRatioSchema = z.enum(["16:9", "9:16"])

export const mayaGenerateVideoSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(2000),
  platform: platformSchema,
  aspect_ratio: videoAspectRatioSchema,
  duration_seconds: z.number().int().min(4).max(10),
  use_logo: z.boolean(),
})
export type MayaGenerateVideoValues = z.infer<typeof mayaGenerateVideoSchema>

export const mayaCampaignVideoSchema = z.object({
  product_image_urls: z.array(z.string().url()).min(1, "Upload at least one product image").max(5),
  campaign_brief: z.string().min(1, "Campaign brief is required").max(5000),
  platform: platformSchema,
  aspect_ratio: videoAspectRatioSchema,
  // 20 is a longer, two-part video (see maya:campaign-video-long) — everything else is a
  // normal single-call generation.
  duration_seconds: z.union([z.number().int().min(4).max(10), z.literal(20)]),
  use_logo: z.boolean(),
})
export type MayaCampaignVideoValues = z.infer<typeof mayaCampaignVideoSchema>
