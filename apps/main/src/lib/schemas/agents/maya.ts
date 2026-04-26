import { z } from "zod"

export const CONTENT_PLATFORMS = ["linkedin", "twitter", "instagram"] as const
export const platformSchema = z.enum(CONTENT_PLATFORMS)

export const mayaIdeationSchema = z.object({
  platform: platformSchema,
  topic_hint: z.string().optional(),
  count: z.number().int().min(1).max(10).optional(),
})
export type MayaIdeationValues = z.infer<typeof mayaIdeationSchema>

export const mayaDraftSchema = z.object({
  topic: z.string().min(3, "Topic is required"),
  platform: platformSchema,
  tone_override: z.string().optional(),
  word_count_target: z.number().int().min(20).max(2000).optional(),
  include_image: z.boolean().optional(),
  use_logo: z.boolean().optional(),
  use_mascot: z.boolean().optional(),
  additional_context: z.string().optional(),
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
  image_url: z.string().url("Use a valid image URL"),
  prompt: z.string().min(3, "Describe the image"),
  platform: platformSchema,
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
