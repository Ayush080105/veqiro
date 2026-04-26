import { z } from "zod"

export const SCOUT_DEPTHS = ["quick", "standard", "deep"] as const
export const SCOUT_SIGNIFICANCE = ["low", "medium", "high"] as const

export const scoutResearchTopicSchema = z.object({
  topic: z.string().min(2, "Topic is required"),
  depth: z.enum(SCOUT_DEPTHS).optional(),
  sources_hint: z.array(z.string().url("Use a valid URL")).optional(),
})
export type ScoutResearchTopicValues = z.infer<typeof scoutResearchTopicSchema>

export const scoutResearchCompanySchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  company_url: z
    .string()
    .url("Use a valid URL")
    .optional()
    .or(z.literal("")),
})
export type ScoutResearchCompanyValues = z.infer<typeof scoutResearchCompanySchema>

export const scoutCompetitorScanSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().min(1, "Name required"),
        url: z.string().url("Use a valid URL"),
        last_scan_hash: z.string().optional(),
      }),
    )
    .min(1, "Add at least one competitor"),
})
export type ScoutCompetitorScanValues = z.infer<typeof scoutCompetitorScanSchema>

export const scoutTrendingTopicsSchema = z.object({
  industry: z.string().min(2, "Industry is required"),
  count: z.number().int().min(1).max(50).optional(),
})
export type ScoutTrendingTopicsValues = z.infer<typeof scoutTrendingTopicsSchema>
