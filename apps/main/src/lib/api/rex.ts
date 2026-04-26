import { apiFetch } from "@/lib/api/client"
import type {
  RexAnalyzeMetricsRequest,
  RexAnalyzeMetricsResult,
  RexForecastRequest,
  RexForecastResult,
  RexFinancialAnalysisRequest,
  RexFinancialAnalysisResult,
  RexBriefingRequest,
  RexBriefingResult,
  RexRunwayRequest,
  RexRunwayResult,
  RexUnitEconomicsRequest,
  RexUnitEconomicsResult,
  RexScenarioRequest,
  RexScenarioResult,
  RexWeeklyDigestRequest,
  RexWeeklyDigestResult,
  RexInvestorUpdateRequest,
  RexInvestorUpdateResult,
  RexSnapshot,
  RexPinnedCard,
  RexSettingsData,
} from "@/lib/types/agents"

export const analyzeMetrics = (body: RexAnalyzeMetricsRequest) =>
  apiFetch<RexAnalyzeMetricsResult>("/agents/rex/analyze-metrics", {
    method: "POST",
    body,
  })

export const forecast = (body: RexForecastRequest) =>
  apiFetch<RexForecastResult>("/agents/rex/forecast", {
    method: "POST",
    body,
  })

export const financialAnalysis = (body: RexFinancialAnalysisRequest) =>
  apiFetch<RexFinancialAnalysisResult>("/agents/rex/financial-analysis", {
    method: "POST",
    body,
  })

export const compileBriefing = (body: RexBriefingRequest) =>
  apiFetch<RexBriefingResult>("/agents/rex/compile-briefing", {
    method: "POST",
    body,
  })

export const runway = (body: RexRunwayRequest) =>
  apiFetch<RexRunwayResult>("/agents/rex/runway", {
    method: "POST",
    body,
  })

export const unitEconomics = (body: RexUnitEconomicsRequest) =>
  apiFetch<RexUnitEconomicsResult>("/agents/rex/unit-economics", {
    method: "POST",
    body,
  })

export const scenario = (body: RexScenarioRequest) =>
  apiFetch<RexScenarioResult>("/agents/rex/scenario", {
    method: "POST",
    body,
  })

export const weeklyDigest = (body: RexWeeklyDigestRequest) =>
  apiFetch<RexWeeklyDigestResult>("/agents/rex/weekly-digest", {
    method: "POST",
    body,
  })

export const investorUpdate = (body: RexInvestorUpdateRequest) =>
  apiFetch<RexInvestorUpdateResult>("/agents/rex/investor-update", {
    method: "POST",
    body,
  })

// ── Phase 3 ───────────────────────────────────────────────────────────────────

export const getSnapshot = () =>
  apiFetch<RexSnapshot>("/agents/rex/snapshot")

export const listPins = () =>
  apiFetch<RexPinnedCard[]>("/agents/rex/pins")

export const createPin = (body: { kind: string; payload: unknown }) =>
  apiFetch<RexPinnedCard>("/agents/rex/pins", { method: "POST", body })

export const deletePin = (id: string) =>
  apiFetch<void>(`/agents/rex/pins/${id}`, { method: "DELETE" })

export const getSettings = () =>
  apiFetch<RexSettingsData>("/agents/rex/settings")

export const patchSettings = (body: { weeklyDigestEnabled?: boolean; weeklyDigestTimezone?: string }) =>
  apiFetch<RexSettingsData>("/agents/rex/settings", { method: "PATCH", body })
