import { z } from "zod";
import {
  sendMessageSchema,
  analyzeMetricsSchema,
  forecastSchema,
  financialAnalysisSchema,
  compileBriefingSchema,
  runwaySchema,
  unitEconomicsSchema,
  scenarioSchema,
  weeklyDigestSchema,
  investorUpdateSchema,
} from "./rex.schema.js";

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type AnalyzeMetricsInput = z.infer<typeof analyzeMetricsSchema>;
export type ForecastInput = z.infer<typeof forecastSchema>;
export type FinancialAnalysisInput = z.infer<typeof financialAnalysisSchema>;
export type CompileBriefingInput = z.infer<typeof compileBriefingSchema>;
export type RunwayInput = z.infer<typeof runwaySchema>;
export type UnitEconomicsInput = z.infer<typeof unitEconomicsSchema>;
export type ScenarioInput = z.infer<typeof scenarioSchema>;
export type WeeklyDigestInput = z.infer<typeof weeklyDigestSchema>;
export type InvestorUpdateInput = z.infer<typeof investorUpdateSchema>;

export interface AssistantMessagePayload {
  response: string;
  image?: { url: string };
  tokens_used?: number;
  model_used?: string;
}

// AI service response shapes (snake_case preserved — proxied verbatim)

export interface AnalyzeMetricsResponse {
  analysis: {
    summary: string;
    trend: string;
    anomalies: unknown[];
    insights: string[];
    health_indicator: string;
  };
  charts_data: Record<string, unknown>;
  tokens_used?: number;
  model_used?: string;
}

export interface ForecastResponse {
  forecast: Array<{ date: string; value: number; lower_bound: number; upper_bound: number }>;
  confidence: number;
  methodology: string;
  summary: string;
  tokens_used?: number;
  model_used?: string;
}

export interface FinancialAnalysisResponse {
  metrics: Record<string, unknown>;
  health_indicator: string;
  narrative: string;
  recommendations: string[];
  tokens_used?: number;
  model_used?: string;
}

export interface CompileBriefingResponse {
  briefing: Record<string, unknown>;
  tokens_used?: number;
  model_used?: string;
}

export interface RunwayResponse {
  months_remaining: number | null;
  date_of_zero: string;
  cash_on_hand: number;
  monthly_burn: number;
  monthly_revenue: number;
  net_burn: number;
  scenarios: unknown[];
  verdict: string;
  recommendation: string;
  tokens_used?: number;
  model_used?: string;
}

export interface UnitEconomicsResponse {
  cac: number;
  ltv: number;
  ltv_cac_ratio: number;
  payback_months: number;
  total_spend_analyzed: number;
  total_new_customers_analyzed: number;
  arpu: number;
  lifetime_months: number;
  ltv_cac_health: string;
  payback_health: string;
  health: string;
  benchmark_context: string;
  recommendations: string[];
  tokens_used?: number;
  model_used?: string;
}

export interface ScenarioResponse {
  base_case: Record<string, unknown>;
  scenarios: unknown[];
  recommendation: string;
  tokens_used?: number;
  model_used?: string;
}

export interface WeeklyDigestResponse {
  period: string;
  headline: string;
  wow_changes: unknown[];
  alerts: unknown[];
  green_flags: unknown[];
  focus_this_week: string[];
  generated_at: string;
  tokens_used?: number;
  model_used?: string;
}

export interface InvestorUpdateResponse {
  subject_line: string;
  executive_summary: string;
  metrics_section: Record<string, unknown>;
  highlights_section: string[];
  challenges_section: string[];
  asks_section: string[];
  full_email_body: string;
  tokens_used?: number;
  model_used?: string;
}
