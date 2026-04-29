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
  all_metrics: z
    .record(z.string(), z.array(dataPointSchema))
    .optional()
    .default({}),
  agent_summaries: z
    .record(z.string(), z.string())
    .optional()
    .default({}),
})
export type RexBriefingValues = z.infer<typeof rexBriefingSchema>

export const rexRunwaySchema = z.object({
  cash_on_hand: z.number().positive("Cash on hand must be positive"),
  monthly_burn: z.number().positive("Monthly burn must be positive"),
  monthly_revenue: z.number().min(0).optional().default(0),
  growth_rate_pct: z.number().min(0).max(200).optional().default(0),
})
export type RexRunwayValues = z.infer<typeof rexRunwaySchema>

export const rexUnitEconomicsSchema = z.object({
  marketing_spend: z
    .array(dataPointSchema)
    .min(1, "Add at least one marketing spend data point"),
  new_customers: z
    .array(dataPointSchema)
    .min(1, "Add at least one new customers data point"),
  avg_monthly_revenue_per_customer: z
    .number()
    .positive("Avg monthly revenue must be positive"),
  avg_customer_lifetime_months: z.number().positive().optional().default(24),
})
export type RexUnitEconomicsValues = z.infer<typeof rexUnitEconomicsSchema>

const scenarioChangeSchema = z.object({
  burn_delta: z.number().optional(),
  mrr_delta: z.number().optional(),
  growth_rate_override: z.number().min(0).optional(),
})

const scenarioItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  changes: scenarioChangeSchema,
})

export const rexScenarioSchema = z.object({
  base_metrics: z.object({
    mrr: z.number().min(0, "MRR must be 0 or more"),
    burn: z.number().min(0, "Burn must be 0 or more"),
    cash: z.number().min(0, "Cash must be 0 or more"),
    growth_rate: z.number().min(0, "Growth rate must be 0 or more"),
  }),
  scenarios: z
    .array(scenarioItemSchema)
    .min(1, "Add at least one scenario"),
})
export type RexScenarioValues = z.infer<typeof rexScenarioSchema>

export const rexWeeklyDigestSchema = z.object({
  metrics: z.record(z.string(), z.number()).refine(
    (m) => Object.keys(m).length > 0,
    "Add at least one metric"
  ),
  prev_week: z.record(z.string(), z.number()).optional().default({}),
})
export type RexWeeklyDigestValues = z.infer<typeof rexWeeklyDigestSchema>

export const rexInvestorUpdateSchema = z.object({
  period: z.string().min(1, "Period is required"),
  metrics: z.record(z.string(), z.unknown()).optional().default({}),
  highlights: z.array(z.string()).optional().default([]),
  asks: z.array(z.string()).optional().default([]),
})
export type RexInvestorUpdateValues = z.infer<typeof rexInvestorUpdateSchema>

// ─── Variance (C9) ──────────────────────────────────────────────────────────

export const rexVarianceSchema = z.object({
  metric: z.string().min(1, "Metric is required"),
  period: z.string().optional().default("monthly"),
})
export type RexVarianceValues = z.infer<typeof rexVarianceSchema>

// ─── Board deck (C5) ────────────────────────────────────────────────────────

export const rexBoardDeckSchema = z.object({
  period: z.string().min(1, "Period is required"),
  metrics: z.record(z.string(), z.unknown()).optional().default({}),
  highlights: z.array(z.string()).optional().default([]),
  risks: z.array(z.string()).optional().default([]),
  ask: z.string().optional().default(""),
})
export type RexBoardDeckValues = z.infer<typeof rexBoardDeckSchema>
