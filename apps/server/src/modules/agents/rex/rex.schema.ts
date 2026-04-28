import { z } from "zod";

const dataPointSchema = z.object({
  date: z.string().min(1),
  value: z.number(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const analyzeMetricsSchema = z.object({
  metrics: z.record(z.string(), z.array(dataPointSchema)),
  period: z.enum(["daily", "weekly", "monthly", "quarterly"]).optional().default("monthly"),
});

export const forecastSchema = z.object({
  metric_name: z.string().min(1).max(200),
  historical_data: z.array(dataPointSchema).min(1),
  horizon_days: z.number().int().min(1).max(365).optional().default(30),
});

export const financialAnalysisSchema = z.object({
  revenue_data: z.array(dataPointSchema).min(1),
  expenses_data: z.array(dataPointSchema).optional().default([]),
  subscribers_data: z.array(dataPointSchema).optional().default([]),
});

export const compileBriefingSchema = z.object({
  date: z.string().optional().default(""),
  all_metrics: z.record(z.string(), z.unknown()).optional().default({}),
  agent_summaries: z.record(z.string(), z.string()).optional().default({}),
});

export const runwaySchema = z.object({
  cash_on_hand: z.number().positive(),
  monthly_burn: z.number().positive(),
  monthly_revenue: z.number().min(0).optional().default(0),
  growth_rate_pct: z.number().optional().default(0),
});

export const unitEconomicsSchema = z.object({
  marketing_spend: z.array(dataPointSchema).min(1),
  new_customers: z.array(dataPointSchema).min(1),
  avg_monthly_revenue_per_customer: z.number().positive(),
  avg_customer_lifetime_months: z.number().positive().optional().default(24),
});

export const scenarioSchema = z.object({
  base_metrics: z.object({
    mrr: z.number().min(0),
    burn: z.number().min(0),
    cash: z.number().min(0),
    growth_rate: z.number().min(0),
  }),
  scenarios: z
    .array(
      z.object({
        name: z.string().min(1),
        changes: z.object({
          burn_delta: z.number().optional(),
          mrr_delta: z.number().optional(),
          growth_rate_override: z.number().optional(),
        }),
      })
    )
    .min(1),
});

export const weeklyDigestSchema = z.object({
  metrics: z.record(z.string(), z.unknown()),
  prev_week: z.record(z.string(), z.unknown()).optional().default({}),
});

export const investorUpdateSchema = z.object({
  period: z.string().min(1),
  metrics: z.record(z.string(), z.unknown()).optional().default({}),
  highlights: z.array(z.string()).optional().default([]),
  asks: z.array(z.string()).optional().default([]),
});

// ── Variance (C9) ───────────────────────────────────────────────────────────

export const varianceSchema = z.object({
  metric: z.string().min(1),
  period: z.string().optional(),
});

// ── Board deck (C5) ─────────────────────────────────────────────────────────

export const boardDeckSchema = z.object({
  period: z.string().min(1),
  metrics: z.record(z.string(), z.unknown()).optional().default({}),
  highlights: z.array(z.string()).optional().default([]),
  risks: z.array(z.string()).optional().default([]),
  ask: z.string().optional().default(""),
});

// ── Webhook ingest (C3) ─────────────────────────────────────────────────────

export const ingestSchema = z.object({
  api_key: z.string().min(8),
  metric: z.string().min(1).max(80),
  date: z.string().min(1),
  value: z.number().finite(),
  period: z.enum(["daily", "weekly", "monthly", "quarterly"]).optional(),
});

// ── Alert rules (C2) ────────────────────────────────────────────────────────

export const alertRuleSchema = z.object({
  id: z.string().min(1),
  metric: z.string().min(1),
  operator: z.enum(["lt", "gt", "change_gt_pct", "change_lt_pct"]),
  threshold: z.number(),
  enabled: z.boolean().default(true),
  label: z.string().optional(),
});
export type AlertRule = z.infer<typeof alertRuleSchema>;
