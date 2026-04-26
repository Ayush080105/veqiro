import { z } from "zod"

export const BLOG_OUTPUT_FORMATS = [
  "markdown",
  "html",
  "wordpress",
  "wix",
] as const

export const sageKeywordResearchSchema = z.object({
  seed_topic: z.string().min(2, "Seed topic is required"),
  niche: z.string().optional(),
  competitor_urls: z.array(z.string().url("Use a valid URL")).optional(),
  count: z.number().int().min(1).max(100).optional(),
})
export type SageKeywordResearchValues = z.infer<typeof sageKeywordResearchSchema>

export const sageGenerateBlogSchema = z.object({
  topic: z.string().min(2, "Topic is required"),
  target_keyword: z.string().min(1, "Target keyword is required"),
  secondary_keywords: z.array(z.string()).optional(),
  word_count: z.number().int().min(100).max(10000).optional(),
  output_format: z.enum(BLOG_OUTPUT_FORMATS).optional(),
  include_meta: z.boolean().optional(),
  include_schema_markup: z.boolean().optional(),
  tone_override: z.string().optional(),
})
export type SageGenerateBlogValues = z.infer<typeof sageGenerateBlogSchema>

export const sageAnalyzeContentSchema = z.object({
  content: z.string().min(1, "Content is required"),
  target_keyword: z.string().min(1, "Target keyword is required"),
  url: z.string().url("Use a valid URL").optional().or(z.literal("")),
})
export type SageAnalyzeContentValues = z.infer<typeof sageAnalyzeContentSchema>

export const sageContentBriefSchema = z.object({
  topic: z.string().min(2, "Topic is required"),
  target_keyword: z.string().min(1, "Target keyword is required"),
  competitor_urls: z.array(z.string().url("Use a valid URL")).optional(),
})
export type SageContentBriefValues = z.infer<typeof sageContentBriefSchema>
