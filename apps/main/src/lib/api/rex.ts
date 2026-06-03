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
  RexSettingsData,
  RexDatasetRecord,
  RexAlertRule,
  RexVarianceRequest,
  RexVarianceResult,
  RexBoardDeckRequest,
  RexBoardDeckResult,
  RexQueryDatasetRequest,
  RexQueryDatasetResult,
  RexAnalyzeDatasetResult,
  RexPinnedCard,
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


export const getSettings = () =>
  apiFetch<RexSettingsData>("/agents/rex/settings")

export const patchSettings = (body: {
  weeklyDigestEnabled?: boolean
  weeklyDigestTimezone?: string
  weeklyDigestRecipients?: string[]
  alertRules?: RexAlertRule[]
}) =>
  apiFetch<RexSettingsData>("/agents/rex/settings", { method: "PATCH", body })

export const listDatasets = () =>
  apiFetch<RexDatasetRecord[]>("/agents/rex/datasets")

export const listPins = () =>
  apiFetch<RexPinnedCard[]>("/agents/rex/pins")

export const deletePin = (id: string) =>
  apiFetch<{ ok: true }>(`/agents/rex/pins/${id}`, { method: "DELETE" })

// ─── New endpoints ───────────────────────────────────────────────────────────

export const variance = (body: RexVarianceRequest) =>
  apiFetch<RexVarianceResult>("/agents/rex/variance", { method: "POST", body })

export const boardDeck = (body: RexBoardDeckRequest) =>
  apiFetch<RexBoardDeckResult>("/agents/rex/board-deck", { method: "POST", body })

// Webhook API key admin
export const generateApiKey = () =>
  apiFetch<{ ingestApiKey: string }>("/agents/rex/api-key/generate", { method: "POST" })

export const revokeApiKey = () =>
  apiFetch<{ ok: true }>("/agents/rex/api-key/revoke", { method: "POST" })


// Query dataset — natural language Q&A on any uploaded CSV/Excel
export const queryDataset = (datasetId: string, body: RexQueryDatasetRequest) =>
  apiFetch<RexQueryDatasetResult>(`/agents/rex/datasets/${datasetId}/query`, {
    method: "POST",
    body,
  })

// Analyze dataset — full automatic AI analysis with insights & recommendations
export const analyzeDataset = (datasetId: string) =>
  apiFetch<RexAnalyzeDatasetResult>(`/agents/rex/datasets/${datasetId}/analyze`, {
    method: "POST",
    body: {},
  })

// Generate full report — multi-page PDF/DOCX analytical report from raw dataset
export const generateDatasetReport = (datasetId: string, format: "pdf" | "docx") =>
  apiFetch<{ file_b64: string; mime_type: string; filename: string }>(
    `/agents/rex/datasets/${datasetId}/report`,
    { method: "POST", body: { format } },
  )
