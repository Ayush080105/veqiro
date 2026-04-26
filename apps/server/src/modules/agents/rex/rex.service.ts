import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { REX_HISTORY_LIMIT } from "../../../config/constants.js";
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
  const userMessage = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });
  const history = await rexRepository.findRecentMessages(
    organizationId,
    REX_HISTORY_LIMIT
  );
  const response = await aiService.post<AssistantMessagePayload>("/ai/rex/chat", {
    user_id: userId,
    organization_id: organizationId,
    conversation_id: userMessage.id,
    message: input.content,
    history,
  });
  if (!response.data) {
    throw new BadRequestError("Failed to get response");
  }

  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: response.data.response,
    imageUrl: response.data.image?.url,
    tokensUsed: response.data.tokens_used,
    model: response.data.model_used,
  });

  return {
    role: "assistant" as const,
    content: response.data.response,
    imageUrl: response.data.image?.url,
    createdAt: userMessage.createdAt,
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

export const parseDataset = async (r2Key: string) => {
  return parseUploaded(r2Key);
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
  }>
) => {
  const created = await Promise.all(
    datasets.map((d) =>
      rexRepository.createDataset({ organizationId, userId, ...d })
    )
  );
  return created;
};

export const removeDataset = (id: string, organizationId: string) =>
  rexRepository.deleteDataset(id, organizationId);

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
