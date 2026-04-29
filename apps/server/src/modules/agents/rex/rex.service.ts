import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { CONTEXT_HISTORY_LIMIT } from "../../../config/constants.js";
import { callAgentWithContext } from "../../../common/utils/contextService.js";
import { Agent } from "../../../../prisma/generated/prisma/client.js";
import * as rexRepository from "./rex.repository.js";
import { parseUploaded } from "./rex.csv.js";
import type {
  SendMessageInput,
  AssistantMessagePayload,
  AnalyzeMetricsInput,
  AnalyzeMetricsResponse,
  ForecastInput,
  ForecastResponse,
  FinancialAnalysisInput,
  FinancialAnalysisResponse,
  CompileBriefingInput,
  CompileBriefingResponse,
  RunwayInput,
  RunwayResponse,
  UnitEconomicsInput,
  UnitEconomicsResponse,
  ScenarioInput,
  ScenarioResponse,
  WeeklyDigestInput,
  WeeklyDigestResponse,
  InvestorUpdateInput,
  InvestorUpdateResponse,
} from "./rex.types.js";

export const sendMessage = async (
  userId: string,
  organizationId: string,
  input: SendMessageInput
) => {
  const history = await rexRepository.findRecentMessages(
    organizationId,
    CONTEXT_HISTORY_LIMIT
  );
  const userMessage = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });
  const responseData = await callAgentWithContext({
    agentApiPath: "/ai/rex/chat",
    agentEnum: Agent.REX,
    agentRole: "Rex: Data analytics and reporting assistant",
    userId,
    organizationId,
    conversationId: userMessage.id,
    userMessage: input.content,
    rawHistory: history,
  }) as AssistantMessagePayload;
  if (!responseData) {
    throw new BadRequestError("Failed to get response");
  }

  const assistantMessage = await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: responseData.response,
    imageUrl: responseData.image?.url,
    tokensUsed: responseData.tokens_used,
    model: responseData.model_used,
  });

  return {
    role: "assistant" as const,
    content: responseData.response,
    imageUrl: responseData.image?.url,
    createdAt: assistantMessage.createdAt,
  };
};

export const listMessages = (organizationId: string) =>
  rexRepository.findAllRexMessages(organizationId);

export const analyzeMetrics = async (
  userId: string,
  organizationId: string,
  input: AnalyzeMetricsInput
) => {
  await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Analyze metrics: ${Object.keys(input.metrics).join(", ")}`,
    customInput: { actionId: "rex:analyze-metrics", input },
  });

  const { data } = await aiService.post<AnalyzeMetricsResponse>(
    "/ai/rex/analyze-metrics",
    {
      user_id: userId,
      organization_id: organizationId,
      metrics: input.metrics,
      period: input.period,
    }
  );

  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: data.analysis?.summary ?? "Metrics analyzed.",
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "rex:analyze-metrics", input, result: data },
  });

  return data;
};

export const forecast = async (
  userId: string,
  organizationId: string,
  input: ForecastInput
) => {
  await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Forecast: ${input.metric_name}`,
    customInput: { actionId: "rex:forecast", input },
  });

  const { data } = await aiService.post<ForecastResponse>("/ai/rex/forecast", {
    user_id: userId,
    organization_id: organizationId,
    metric_name: input.metric_name,
    historical_data: input.historical_data,
    horizon_days: input.horizon_days,
  });

  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: data.summary ?? "Forecast generated.",
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "rex:forecast", input, result: data },
  });

  return data;
};

export const financialAnalysis = async (
  userId: string,
  organizationId: string,
  input: FinancialAnalysisInput
) => {
  await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: "Financial analysis",
    customInput: { actionId: "rex:financial-analysis", input },
  });

  const { data } = await aiService.post<FinancialAnalysisResponse>(
    "/ai/rex/financial-analysis",
    {
      user_id: userId,
      organization_id: organizationId,
      revenue_data: input.revenue_data,
      expenses_data: input.expenses_data,
      subscribers_data: input.subscribers_data,
    }
  );

  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: data.narrative ?? "Financial analysis complete.",
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "rex:financial-analysis", input, result: data },
  });

  return data;
};

export const compileBriefing = async (
  userId: string,
  organizationId: string,
  input: CompileBriefingInput
) => {
  await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Executive briefing for ${input.date || "today"}`,
    customInput: { actionId: "rex:compile-briefing", input },
  });

  const { data } = await aiService.post<CompileBriefingResponse>(
    "/ai/rex/compile-briefing",
    {
      user_id: userId,
      organization_id: organizationId,
      date: input.date,
      all_metrics: input.all_metrics,
      agent_summaries: input.agent_summaries,
    }
  );

  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: "Executive briefing compiled.",
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "rex:compile-briefing", input, result: data },
  });

  return data;
};

export const runway = async (
  userId: string,
  organizationId: string,
  input: RunwayInput
) => {
  await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Runway analysis — $${input.cash_on_hand.toLocaleString()} cash, $${input.monthly_burn.toLocaleString()}/mo burn`,
    customInput: { actionId: "rex:runway", input },
  });

  const { data } = await aiService.post<RunwayResponse>("/ai/rex/runway", {
    user_id: userId,
    organization_id: organizationId,
    cash_on_hand: input.cash_on_hand,
    monthly_burn: input.monthly_burn,
    monthly_revenue: input.monthly_revenue,
    growth_rate_pct: input.growth_rate_pct,
  });

  const monthsLabel =
    data.months_remaining != null
      ? `${data.months_remaining.toFixed(1)} months`
      : "profitable";
  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Runway: ${monthsLabel} (${data.verdict})`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "rex:runway", input, result: data },
  });

  return data;
};

export const unitEconomics = async (
  userId: string,
  organizationId: string,
  input: UnitEconomicsInput
) => {
  await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: "Unit economics analysis",
    customInput: { actionId: "rex:unit-economics", input },
  });

  const { data } = await aiService.post<UnitEconomicsResponse>(
    "/ai/rex/unit-economics",
    {
      user_id: userId,
      organization_id: organizationId,
      marketing_spend: input.marketing_spend,
      new_customers: input.new_customers,
      avg_monthly_revenue_per_customer: input.avg_monthly_revenue_per_customer,
      avg_customer_lifetime_months: input.avg_customer_lifetime_months,
    }
  );

  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `CAC $${data.cac?.toFixed(0)}, LTV $${data.ltv?.toFixed(0)}, LTV:CAC ${data.ltv_cac_ratio?.toFixed(1)}x`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "rex:unit-economics", input, result: data },
  });

  return data;
};

export const scenario = async (
  userId: string,
  organizationId: string,
  input: ScenarioInput
) => {
  await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `What-if scenarios: ${input.scenarios.map((s) => s.name).join(", ")}`,
    customInput: { actionId: "rex:scenario", input },
  });

  const { data } = await aiService.post<ScenarioResponse>("/ai/rex/scenario", {
    user_id: userId,
    organization_id: organizationId,
    base_metrics: input.base_metrics,
    scenarios: input.scenarios,
  });

  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: data.recommendation ?? "Scenarios modeled.",
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "rex:scenario", input, result: data },
  });

  return data;
};

export const weeklyDigest = async (
  userId: string,
  organizationId: string,
  input: WeeklyDigestInput
) => {
  await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: "Weekly CFO digest",
    customInput: { actionId: "rex:weekly-digest", input },
  });

  const { data } = await aiService.post<WeeklyDigestResponse>(
    "/ai/rex/weekly-digest",
    {
      user_id: userId,
      organization_id: organizationId,
      metrics: input.metrics,
      prev_week: input.prev_week,
    }
  );

  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: data.headline ?? "Weekly digest generated.",
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "rex:weekly-digest", input, result: data },
  });

  return data;
};

// ── Snapshot ─────────────────────────────────────────────────────────────────

export const getSnapshot = async (organizationId: string) => {
  const digestMsg = await rexRepository.findLatestDigestMessage(organizationId);
  if (digestMsg?.customInput) {
    const ci = digestMsg.customInput as Record<string, unknown>;
    const result = ci.result as Record<string, unknown> | undefined;
    if (result) {
      return { ready: true, source: "digest", data: result };
    }
  }
  const datasets = await rexRepository.findDatasets(organizationId);
  if (datasets.length === 0) return { ready: false };

  const byKey = (key: string) =>
    datasets
      .filter((d) => d.metricKey === key)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

  const mrrDs = byKey("mrr");
  const burnDs = byKey("burn") ?? byKey("expenses");
  const cashDs = byKey("cash");

  const lastPoint = (ds: typeof mrrDs) => {
    if (!ds) return null;
    const pts = ds.points as Array<{ date: string; value: number }>;
    return pts.length ? pts[pts.length - 1].value : null;
  };

  const mrr = lastPoint(mrrDs);
  const burn = lastPoint(burnDs);
  const cash = lastPoint(cashDs);
  const runway = mrr != null && burn != null && burn > mrr ? (cash ?? 0) / (burn - mrr) : null;

  return {
    ready: true,
    source: "datasets",
    data: { mrr, burn, cash, runway_months: runway != null ? Math.round(runway * 10) / 10 : null },
  };
};

// ── Pins ─────────────────────────────────────────────────────────────────────

export const listPins = (organizationId: string) =>
  rexRepository.findPins(organizationId);

export const createPin = (userId: string, organizationId: string, kind: string, payload: unknown) =>
  rexRepository.createPin({ organizationId, userId, kind, payload });

export const removePin = (id: string, organizationId: string) =>
  rexRepository.deletePin(id, organizationId);

// ── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = (organizationId: string) =>
  rexRepository.findOrCreateSettings(organizationId);

export const patchSettings = (
  organizationId: string,
  patch: { weeklyDigestEnabled?: boolean; weeklyDigestTimezone?: string; weeklyDigestRecipients?: string[] }
) => rexRepository.updateSettings(organizationId, patch);

// ── Datasets ─────────────────────────────────────────────────────────────────

export const listDatasets = (organizationId: string) =>
  rexRepository.findDatasets(organizationId);

export const parseDataset = async (organizationId: string, r2Key: string) => {
  const result = await parseUploaded(r2Key);
  // C7: surface saved column mapping from prior uploads — and apply it
  // when the headers match, so column → metricKey is stable across uploads.
  try {
    const settings = await rexRepository.findOrCreateSettings(organizationId);
    const tpl = settings.columnMappingTemplates as Record<string, unknown> | null | undefined;
    const saved = tpl?.["last"] as
      | { dateColumn: string; valueColumns: Array<{ column: string; metricKey: string }> }
      | undefined;
    if (saved) {
      result.saved_mapping = saved;
      // If the saved mapping's columns are still present, rewrite metric keys
      const savedByColumn = new Map(saved.valueColumns.map((v) => [v.column, v.metricKey]));
      let applied = 0;
      for (const vc of result.candidate_mapping.valueColumns) {
        const key = savedByColumn.get(vc.column);
        if (key && key !== vc.metricKey) {
          // Update both the candidate mapping and the dataset entry
          const ds = result.datasets.find((d) => d.metricKey === vc.metricKey);
          if (ds) ds.metricKey = key;
          vc.metricKey = key;
          applied += 1;
        }
      }
      if (applied > 0) {
        result.warnings = [
          ...(result.warnings ?? []),
          `Applied saved mapping from prior upload: renamed ${applied} column${applied > 1 ? "s" : ""}`,
        ];
      }
    }
  } catch {
    // best-effort
  }
  return result;
};

export const saveDatasets = async (
  userId: string,
  organizationId: string,
  datasets: Array<{
    name: string;
    metricKey: string;
    period: string;
    points: unknown;
    unit?: string | null;
    sourceId?: string | null;
    meta?: unknown;
    purpose?: string;
  }>,
  mapping?: { dateColumn: string; valueColumns: Array<{ column: string; metricKey: string }> }
) => {
  const created = await Promise.all(
    datasets.map((d) =>
      rexRepository.createDataset({ organizationId, userId, ...d })
    )
  );
  // C7: persist the mapping so the next upload can auto-apply
  if (mapping && mapping.dateColumn) {
    try {
      const existing = await rexRepository.findOrCreateSettings(organizationId);
      const tpl = (existing.columnMappingTemplates as Record<string, unknown> | null) ?? {};
      tpl["last"] = mapping;
      await rexRepository.updateSettings(organizationId, { columnMappingTemplates: tpl });
    } catch {
      // best-effort
    }
  }
  return created;
};

export const removeDataset = (id: string, organizationId: string) =>
  rexRepository.deleteDataset(id, organizationId);

// ── Webhook ingest (C3) ──────────────────────────────────────────────────────

export const generateApiKey = async (organizationId: string) => {
  const { randomBytes } = await import("crypto");
  const key = `rex_${randomBytes(24).toString("hex")}`;
  await rexRepository.updateSettings(organizationId, { ingestApiKey: key });
  return { ingestApiKey: key };
};

export const revokeApiKey = async (organizationId: string) => {
  await rexRepository.updateSettings(organizationId, { ingestApiKey: null });
  return { ok: true };
};

export const ingestPoint = async (input: {
  api_key: string;
  metric: string;
  date: string;
  value: number;
  period?: "daily" | "weekly" | "monthly" | "quarterly";
}) => {
  const settings = await rexRepository.findOrgByApiKey(input.api_key);
  if (!settings) throw new BadRequestError("Invalid API key");

  const period = input.period ?? "monthly";
  const isoDate = new Date(input.date);
  if (isNaN(isoDate.getTime())) throw new BadRequestError("Invalid date format");
  const dateStr = isoDate.toISOString().slice(0, 10);

  const existing = await rexRepository.findDatasetForMetric(settings.organizationId, input.metric);

  if (existing) {
    const points = (existing.points as Array<{ date: string; value: number }>) ?? [];
    const idx = points.findIndex((p) => p.date === dateStr);
    if (idx >= 0) {
      points[idx] = { date: dateStr, value: input.value };
    } else {
      points.push({ date: dateStr, value: input.value });
      points.sort((a, b) => a.date.localeCompare(b.date));
    }
    const updated = await rexRepository.updateDatasetPoints(existing.id, points);
    return { ok: true, datasetId: updated.id, pointsCount: points.length, mode: "appended" as const };
  }

  // First point for this metric → create new dataset
  const created = await rexRepository.createDataset({
    organizationId: settings.organizationId,
    userId: "webhook",
    name: `${input.metric} (webhook)`,
    metricKey: input.metric,
    period,
    points: [{ date: dateStr, value: input.value }],
    purpose: "actual",
    meta: { source: "webhook", createdBy: "rex:ingest" },
  });
  return { ok: true, datasetId: created.id, pointsCount: 1, mode: "created" as const };
};

// ── Variance (C9) ────────────────────────────────────────────────────────────

export const variance = async (
  userId: string,
  organizationId: string,
  input: { metric: string; period?: string }
) => {
  await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Variance analysis: ${input.metric}`,
    customInput: { actionId: "rex:variance", input },
  });

  const datasets = await rexRepository.findDatasets(organizationId);
  const actual = datasets.find((d) => d.metricKey === input.metric && (d as unknown as { purpose?: string }).purpose !== "budget");
  const budget = datasets.find((d) => d.metricKey === input.metric && (d as unknown as { purpose?: string }).purpose === "budget");

  if (!actual || !budget) {
    throw new BadRequestError(
      `Need both an "actual" and a "budget" dataset for metric '${input.metric}'. Upload a dataset and tag it as budget in the Data tab.`
    );
  }

  const { data } = await aiService.post<Record<string, unknown>>("/ai/rex/variance", {
    user_id: userId,
    organization_id: organizationId,
    metric: input.metric,
    period: input.period ?? "monthly",
    actual_data: actual.points,
    budget_data: budget.points,
  });

  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: (data.headline as string) ?? "Variance computed.",
    tokensUsed: data.tokens_used as number | undefined,
    model: data.model_used as string | undefined,
    customInput: { actionId: "rex:variance", input, result: data },
  });
  return data;
};

// ── Board deck (C5) ──────────────────────────────────────────────────────────

export const boardDeck = async (
  userId: string,
  organizationId: string,
  input: { period: string; metrics?: Record<string, unknown>; highlights?: string[]; risks?: string[]; ask?: string }
) => {
  await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Board deck — ${input.period}`,
    customInput: { actionId: "rex:board-deck", input },
  });

  const { data } = await aiService.post<Record<string, unknown>>("/ai/rex/board-deck", {
    user_id: userId,
    organization_id: organizationId,
    period: input.period,
    metrics: input.metrics ?? {},
    highlights: input.highlights ?? [],
    risks: input.risks ?? [],
    ask: input.ask ?? "",
  });

  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: (data.headline as string) ?? "Board deck drafted.",
    tokensUsed: data.tokens_used as number | undefined,
    model: data.model_used as string | undefined,
    customInput: { actionId: "rex:board-deck", input, result: data },
  });
  return data;
};

// ── Pin sharing (C10) ────────────────────────────────────────────────────────

export const sharePin = async (id: string, organizationId: string, isPublic: boolean) => {
  const pin = await rexRepository.findPin(id, organizationId);
  if (!pin) throw new BadRequestError("Pin not found");

  let shareToken = pin.shareToken;
  if (isPublic && !shareToken) {
    const { randomBytes } = await import("crypto");
    shareToken = randomBytes(16).toString("hex");
  }
  if (!isPublic) {
    shareToken = null;
  }
  await rexRepository.updatePin(id, organizationId, { isPublic, shareToken });
  return { id, isPublic, shareToken };
};

export const getSharedPin = async (token: string) => {
  const pin = await rexRepository.findPinByShareToken(token);
  if (!pin || !pin.isPublic) return null;
  return { kind: pin.kind, payload: pin.payload, createdAt: pin.createdAt };
};

export const investorUpdate = async (
  userId: string,
  organizationId: string,
  input: InvestorUpdateInput
) => {
  await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Investor update — ${input.period}`,
    customInput: { actionId: "rex:investor-update", input },
  });

  const { data } = await aiService.post<InvestorUpdateResponse>(
    "/ai/rex/investor-update",
    {
      user_id: userId,
      organization_id: organizationId,
      period: input.period,
      metrics: input.metrics,
      highlights: input.highlights,
      asks: input.asks,
    }
  );

  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: data.subject_line ?? "Investor update drafted.",
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "rex:investor-update", input, result: data },
  });

  return data;
};
