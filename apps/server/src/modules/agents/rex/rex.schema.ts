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
  metricName: z.string().min(1).max(200),
  historicalData: z.array(dataPointSchema).min(1),
  horizonDays: z.number().int().min(1).max(365).optional().default(30),
});

export const financialAnalysisSchema = z.object({
  revenueData: z.array(dataPointSchema).min(1),
  expensesData: z.array(dataPointSchema).optional().default([]),
  subscribersData: z.array(dataPointSchema).optional().default([]),
});

export const compileBriefingSchema = z.object({
  date: z.string().optional().default(""),
  allMetrics: z.record(z.string(), z.unknown()).optional().default({}),
  agentSummaries: z.record(z.string(), z.string()).optional().default({}),
});

export const runwaySchema = z.object({
  cashOnHand: z.number().positive(),
  monthlyBurn: z.number().positive(),
  monthlyRevenue: z.number().min(0).optional().default(0),
  growthRatePct: z.number().optional().default(0),
});

export const unitEconomicsSchema = z.object({
  marketingSpend: z.array(dataPointSchema).min(1),
  newCustomers: z.array(dataPointSchema).min(1),
  avgMonthlyRevenuePerCustomer: z.number().positive(),
  avgCustomerLifetimeMonths: z.number().positive().optional().default(24),
});

export const scenarioSchema = z.object({
  baseMetrics: z.object({
    mrr: z.number().min(0),
    burn: z.number().min(0),
    cash: z.number().min(0),
    growthRate: z.number().min(0),
  }),
  scenarios: z
    .array(
      z.object({
        name: z.string().min(1),
        changes: z.object({
          burnDelta: z.number().optional(),
          mrrDelta: z.number().optional(),
          growthRateOverride: z.number().optional(),
        }),
      })
    )
    .min(1),
});

export const weeklyDigestSchema = z.object({
  metrics: z.record(z.string(), z.unknown()),
  prevWeek: z.record(z.string(), z.unknown()).optional().default({}),
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
  apiKey: z.string().min(8),
  metric: z.string().min(1).max(80),
  date: z.string().min(1),
  value: z.number().finite(),
  period: z.enum(["daily", "weekly", "monthly", "quarterly"]).optional(),
});

// ── Query dataset (natural language Q&A on any uploaded CSV/Excel) ───────────

export const queryDatasetSchema = z.object({
  query: z.string().min(1).max(2000),
});

// ── Analyze dataset (full automatic AI analysis) ─────────────────────────────

export const analyzeDatasetSchema = z.object({});

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
