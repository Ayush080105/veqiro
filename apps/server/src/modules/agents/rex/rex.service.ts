import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { CONTEXT_HISTORY_LIMIT } from "../../../config/constants.js";
import { callAgentWithContext } from "../../../common/utils/contextService.js";
import { Agent } from "../../../../prisma/generated/prisma/client.js";
import * as rexRepository from "./rex.repository.js";
import { parseUploaded } from "./rex.csv.js";
import type {
  SendMessageInput,
  QueryDatasetInput,
  QueryDatasetResponse,
  AnalyzeDatasetResponse,
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
import type { RawTable } from "./rex.csv.js";

export const sendMessage = async (
  userId: string,
  organizationId: string,
  input: SendMessageInput
) => {
  const [history, datasets] = await Promise.all([
    rexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    rexRepository.findDatasets(organizationId),
  ]);

  // Build a brief dataset context summary so REX can answer data questions in chat
  let datasetContext = "";
  if (datasets.length > 0) {
    const summaries = datasets.slice(0, 5).map((ds) => {
      const meta = ds.meta as Record<string, unknown> | null;
      const rawTable = meta?.rawTable as RawTable | undefined;
      const pts = ds.points as Array<{ date: string; value: number }>;
      if (rawTable && rawTable.headers.length > 0) {
        const types = Object.entries(rawTable.columnTypes)
          .map(([col, t]) => `${col}(${t})`)
          .join(", ");
        return `• ${ds.name} [${rawTable.rows.length} rows, columns: ${types}]`;
      }
      return `• ${ds.name} [metric=${ds.metricKey}, ${pts.length} data points, period=${ds.period}]`;
    });
    datasetContext = `\n\nUser's uploaded datasets:\n${summaries.join("\n")}`;
  }

  const userMessage = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });
  const responseData = await callAgentWithContext({
    agentApiPath: "/ai/rex/chat",
    agentEnum: Agent.REX,
    agentRole: `Rex: Data analytics and reporting assistant.${datasetContext}`,
    userId,
    organizationId,
    conversationId: userMessage.id,
    userMessage: input.content,
    rawHistory: history,
  }) as AssistantMessagePayload;
  if (!responseData) {
    throw new BadRequestError("Failed to get response");
  }

  const customInput =
    responseData.action_id && responseData.action_result
      ? { actionId: responseData.action_id, input: {}, result: responseData.action_result }
      : undefined;

  const assistantMessage = await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: responseData.response,
    imageUrl: responseData.image?.url,
    tokensUsed: responseData.tokens_used,
    model: responseData.model_used,
    customInput,
  });

  return {
    role: "assistant" as const,
    content: responseData.response,
    imageUrl: responseData.image?.url,
    customInput: customInput ?? null,
    createdAt: assistantMessage.createdAt,
  };
};

export const listMessages = (organizationId: string) =>
  rexRepository.findAllRexMessages(organizationId);

// ── Query dataset: natural language Q&A on any uploaded CSV/Excel ─────────────

export const queryDataset = async (
  userId: string,
  organizationId: string,
  datasetId: string,
  input: QueryDatasetInput
) => {
  const dataset = await rexRepository.findDataset(datasetId, organizationId);
  if (!dataset) {
    throw new BadRequestError("Dataset not found");
  }

  // Extract table data: prefer rawTable from meta, fall back to points for legacy datasets
  const meta = dataset.meta as Record<string, unknown> | null;
  const rawTable = meta?.rawTable as RawTable | undefined;
  const points = dataset.points as Array<{ date: string; value: number }>;

  let tableForAI: Record<string, unknown>;
  if (rawTable && rawTable.headers.length > 0) {
    tableForAI = {
      headers: rawTable.headers,
      rows: rawTable.rows.slice(0, 300),
      columnTypes: rawTable.columnTypes,
    };
  } else if (points.length > 0) {
    // Legacy dataset — synthesize a table from time-series points
    tableForAI = {
      headers: ["date", dataset.metricKey],
      rows: points.map((p) => ({ date: p.date, [dataset.metricKey]: p.value })),
      columnTypes: { date: "date", [dataset.metricKey]: "numeric" },
    };
  } else {
    throw new BadRequestError("Dataset has no data to query");
  }

  await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: input.query,
    customInput: { actionId: "rex:query-dataset", datasetId, datasetName: dataset.name },
  });

  const { data } = await aiService.post<QueryDatasetResponse>("/ai/rex/query-dataset", {
    user_id: userId,
    organization_id: organizationId,
    dataset_name: dataset.name,
    query: input.query,
    table: tableForAI,
  });

  // Embed dataset name and original query inside result so the chat card can display them
  const resultWithMeta = { ...data, _datasetName: dataset.name, _query: input.query };

  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: data.answer ?? "Query complete.",
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "rex:query-dataset", datasetId, result: resultWithMeta },
  });

  return resultWithMeta;
};

// ── Analyze dataset — full automatic AI analysis ──────────────────────────────

export const analyzeDataset = async (
  userId: string,
  organizationId: string,
  datasetId: string,
) => {
  const dataset = await rexRepository.findDataset(datasetId, organizationId);
  if (!dataset) {
    throw new BadRequestError("Dataset not found");
  }

  const meta = dataset.meta as Record<string, unknown> | null;
  const rawTable = meta?.rawTable as RawTable | undefined;
  const points = dataset.points as Array<{ date: string; value: number }>;

  let tableForAI: Record<string, unknown>;
  if (rawTable && rawTable.headers.length > 0) {
    tableForAI = {
      headers: rawTable.headers,
      rows: rawTable.rows.slice(0, 300),
      columnTypes: rawTable.columnTypes,
    };
  } else if (points.length > 0) {
    tableForAI = {
      headers: ["date", dataset.metricKey],
      rows: points.map((p) => ({ date: p.date, [dataset.metricKey]: p.value })),
      columnTypes: { date: "date", [dataset.metricKey]: "numeric" },
    };
  } else {
    throw new BadRequestError("Dataset has no data to analyze");
  }

  await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Analyze dataset: ${dataset.name}`,
    customInput: { actionId: "rex:analyze-dataset", datasetId, datasetName: dataset.name },
  });

  const { data } = await aiService.post<AnalyzeDatasetResponse>("/ai/rex/analyze-dataset", {
    user_id: userId,
    organization_id: organizationId,
    dataset_name: dataset.name,
    table: tableForAI,
  });

  const resultWithMeta = { ...data, _datasetName: dataset.name };

  await rexRepository.createAssistantMessage({
    organizationId,
    userId,
    content: data.summary ?? "Analysis complete.",
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "rex:analyze-dataset", datasetId, result: resultWithMeta },
  });

  return resultWithMeta;
};

// ── Generate full report (multi-page PDF/DOCX) ────────────────────────────────

export const generateDatasetReport = async (
  userId: string,
  organizationId: string,
  datasetId: string,
  format: "pdf" | "docx",
) => {
  const dataset = await rexRepository.findDataset(datasetId, organizationId);
  if (!dataset) throw new BadRequestError("Dataset not found");

  const meta = dataset.meta as Record<string, unknown> | null;
  const rawTable = meta?.rawTable as RawTable | undefined;
  const points = dataset.points as Array<{ date: string; value: number }>;

  let tableForAI: Record<string, unknown>;
  if (rawTable && rawTable.headers.length > 0) {
    tableForAI = {
      headers: rawTable.headers,
      rows: rawTable.rows,          // pass full table — report does its own capping
      columnTypes: rawTable.columnTypes,
    };
  } else if (points.length > 0) {
    tableForAI = {
      headers: ["date", dataset.metricKey],
      rows: points.map((p) => ({ date: p.date, [dataset.metricKey]: p.value })),
      columnTypes: { date: "date", [dataset.metricKey]: "numeric" },
    };
  } else {
    throw new BadRequestError("Dataset has no data to report");
  }

  const { data } = await aiService.post<{ file_b64: string; mime_type: string; filename: string }>(
    "/ai/rex/generate-report",
    {
      user_id: userId,
      organization_id: organizationId,
      dataset_name: dataset.name,
      format,
      raw_table: tableForAI,
    },
  );
  return data;
};

export const analyzeMetrics = async (
  userId: string,
  organizationId: string,
  input: AnalyzeMetricsInput
) => {
  const history = await rexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Analyze metrics: ${Object.keys(input.metrics).join(", ")}`,
    customInput: { actionId: "rex:analyze-metrics", input },
  });

  const data = await callAgentWithContext<AnalyzeMetricsResponse>({
    agentApiPath: "/ai/rex/analyze-metrics",
    agentEnum: Agent.REX,
    agentRole: "Rex: Data analytics and reporting assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Analyze metrics: ${Object.keys(input.metrics).join(", ")}`,
    rawHistory: history,
    topLevelPayload: { metrics: input.metrics, period: input.period },
  });

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
  const history = await rexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Forecast: ${input.metricName}`,
    customInput: { actionId: "rex:forecast", input },
  });

  const data = await callAgentWithContext<ForecastResponse>({
    agentApiPath: "/ai/rex/forecast",
    agentEnum: Agent.REX,
    agentRole: "Rex: Data analytics and reporting assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Forecast: ${input.metricName}`,
    rawHistory: history,
    topLevelPayload: {
      metric_name: input.metricName,
      historical_data: input.historicalData,
      horizon_days: input.horizonDays,
    },
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
  const history = await rexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: "Financial analysis",
    customInput: { actionId: "rex:financial-analysis", input },
  });

  const data = await callAgentWithContext<FinancialAnalysisResponse>({
    agentApiPath: "/ai/rex/financial-analysis",
    agentEnum: Agent.REX,
    agentRole: "Rex: Data analytics and reporting assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: "Financial analysis",
    rawHistory: history,
    topLevelPayload: {
      revenue_data: input.revenueData,
      expenses_data: input.expensesData,
      subscribers_data: input.subscribersData,
    },
  });

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
  const history = await rexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Executive briefing for ${input.date || "today"}`,
    customInput: { actionId: "rex:compile-briefing", input },
  });

  const data = await callAgentWithContext<CompileBriefingResponse>({
    agentApiPath: "/ai/rex/compile-briefing",
    agentEnum: Agent.REX,
    agentRole: "Rex: Data analytics and reporting assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Executive briefing for ${input.date || "today"}`,
    rawHistory: history,
    topLevelPayload: {
      date: input.date,
      all_metrics: input.allMetrics,
      agent_summaries: input.agentSummaries,
    },
  });

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
  const history = await rexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Runway analysis — $${input.cashOnHand.toLocaleString()} cash, $${input.monthlyBurn.toLocaleString()}/mo burn`,
    customInput: { actionId: "rex:runway", input },
  });

  const data = await callAgentWithContext<RunwayResponse>({
    agentApiPath: "/ai/rex/runway",
    agentEnum: Agent.REX,
    agentRole: "Rex: Data analytics and reporting assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Runway analysis — $${input.cashOnHand.toLocaleString()} cash, $${input.monthlyBurn.toLocaleString()}/mo burn`,
    rawHistory: history,
    topLevelPayload: {
      cash_on_hand: input.cashOnHand,
      monthly_burn: input.monthlyBurn,
      monthly_revenue: input.monthlyRevenue,
      growth_rate_pct: input.growthRatePct,
    },
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
  const history = await rexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: "Unit economics analysis",
    customInput: { actionId: "rex:unit-economics", input },
  });

  const data = await callAgentWithContext<UnitEconomicsResponse>({
    agentApiPath: "/ai/rex/unit-economics",
    agentEnum: Agent.REX,
    agentRole: "Rex: Data analytics and reporting assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: "Unit economics analysis",
    rawHistory: history,
    topLevelPayload: {
      marketing_spend: input.marketingSpend,
      new_customers: input.newCustomers,
      avg_monthly_revenue_per_customer: input.avgMonthlyRevenuePerCustomer,
      avg_customer_lifetime_months: input.avgCustomerLifetimeMonths,
    },
  });

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
  const history = await rexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `What-if scenarios: ${input.scenarios.map((s) => s.name).join(", ")}`,
    customInput: { actionId: "rex:scenario", input },
  });

  const data = await callAgentWithContext<ScenarioResponse>({
    agentApiPath: "/ai/rex/scenario",
    agentEnum: Agent.REX,
    agentRole: "Rex: Data analytics and reporting assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `What-if scenarios: ${input.scenarios.map((s) => s.name).join(", ")}`,
    rawHistory: history,
    topLevelPayload: {
      base_metrics: input.baseMetrics,
      scenarios: input.scenarios,
    },
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
  const history = await rexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: "Weekly CFO digest",
    customInput: { actionId: "rex:weekly-digest", input },
  });

  const data = await callAgentWithContext<WeeklyDigestResponse>({
    agentApiPath: "/ai/rex/weekly-digest",
    agentEnum: Agent.REX,
    agentRole: "Rex: Data analytics and reporting assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: "Weekly CFO digest",
    rawHistory: history,
    topLevelPayload: { metrics: input.metrics, prev_week: input.prevWeek },
  });

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
  apiKey: string;
  metric: string;
  date: string;
  value: number;
  period?: "daily" | "weekly" | "monthly" | "quarterly";
}) => {
  const settings = await rexRepository.findOrgByApiKey(input.apiKey);
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
  const [history, datasets] = await Promise.all([
    rexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    rexRepository.findDatasets(organizationId),
  ]);

  const actual = datasets.find((d) => d.metricKey === input.metric && (d as unknown as { purpose?: string }).purpose !== "budget");
  const budget = datasets.find((d) => d.metricKey === input.metric && (d as unknown as { purpose?: string }).purpose === "budget");

  if (!actual || !budget) {
    throw new BadRequestError(
      `Need both an "actual" and a "budget" dataset for metric '${input.metric}'. Upload a dataset and tag it as budget in the Data tab.`
    );
  }

  const userMsg = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Variance analysis: ${input.metric}`,
    customInput: { actionId: "rex:variance", input },
  });

  const data = await callAgentWithContext<Record<string, unknown>>({
    agentApiPath: "/ai/rex/variance",
    agentEnum: Agent.REX,
    agentRole: "Rex: Data analytics and reporting assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Variance analysis: ${input.metric}`,
    rawHistory: history,
    topLevelPayload: {
      metric: input.metric,
      period: input.period ?? "monthly",
      actual_data: actual.points,
      budget_data: budget.points,
    },
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
  const history = await rexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Board deck — ${input.period}`,
    customInput: { actionId: "rex:board-deck", input },
  });

  const data = await callAgentWithContext<Record<string, unknown>>({
    agentApiPath: "/ai/rex/board-deck",
    agentEnum: Agent.REX,
    agentRole: "Rex: Data analytics and reporting assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Board deck — ${input.period}`,
    rawHistory: history,
    topLevelPayload: {
      period: input.period,
      metrics: input.metrics ?? {},
      highlights: input.highlights ?? [],
      risks: input.risks ?? [],
      ask: input.ask ?? "",
    },
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
  const history = await rexRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await rexRepository.createUserMessage({
    organizationId,
    userId,
    content: `Investor update — ${input.period}`,
    customInput: { actionId: "rex:investor-update", input },
  });

  const data = await callAgentWithContext<InvestorUpdateResponse>({
    agentApiPath: "/ai/rex/investor-update",
    agentEnum: Agent.REX,
    agentRole: "Rex: Data analytics and reporting assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Investor update — ${input.period}`,
    rawHistory: history,
    topLevelPayload: {
      period: input.period,
      metrics: input.metrics,
      highlights: input.highlights,
      asks: input.asks,
    },
  });

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
