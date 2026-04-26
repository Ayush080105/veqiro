import { z } from "zod"

export const REX_PERIODS = ["daily", "weekly", "monthly", "quarterly"] as const

export const dataPointSchema = z.object({
  date: z.string().min(1, "Date is required"),
  value: z.number(),
})

export const rexAnalyzeMetricsSchema = z.object({
  metrics: z
    .record(z.string(), z.array(dataPointSchema).min(1, "Add at least one data point"))
    .refine((m) => Object.keys(m).length > 0, "Add at least one metric"),
  period: z.enum(REX_PERIODS).optional(),
})
export type RexAnalyzeMetricsValues = z.infer<typeof rexAnalyzeMetricsSchema>

export const rexForecastSchema = z.object({
  metric_name: z.string().min(1, "Metric name is required"),
  historical_data: z
    .array(dataPointSchema)
    .min(3, "Provide at least 3 historical data points"),
  horizon_days: z.number().int().min(1).max(365).optional(),
})
export type RexForecastValues = z.infer<typeof rexForecastSchema>

export const rexFinancialAnalysisSchema = z.object({
  revenue_data: z
    .array(dataPointSchema)
    .min(1, "Add at least one revenue data point"),
  expenses_data: z.array(dataPointSchema).optional(),
  subscribers_data: z.array(dataPointSchema).optional(),
})
export type RexFinancialAnalysisValues = z.infer<typeof rexFinancialAnalysisSchema>

export const rexBriefingSchema = z.object({
  date: z.string().min(1, "Date is required"),
  all_metrics: z.record(z.string(), z.array(dataPointSchema)),
  agent_summaries: z.record(z.string(), z.string()),
})
export type RexBriefingValues = z.infer<typeof rexBriefingSchema>
