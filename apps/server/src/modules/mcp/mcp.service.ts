import { BadRequestError } from "../../common/errors/badRequest.js";
import { NotFoundError } from "../../common/errors/notFound.js";
import { Agent, McpActionSource, McpApprovalMode, McpConnectionStatus, McpPendingActionStatus, McpProvider } from "../../../prisma/generated/prisma/client.js";
import { aiService } from "../../common/utils/aiService.js";
import { prisma } from "../../config/prisma.js";
import * as repo from "./mcp.repository.js";
import { getIntegrationBySlug, getIntegrationsByAgent, type AgentSlug, type IntegrationCatalogEntry } from "@repo/integrations-catalog";
import type {
  ConnectResult,
  McpConnectionRef,
  McpConnectionSummary,
  McpPendingActionSummary,
  RawPendingAction,
  ToolTraceEntry,
} from "./mcp.types.js";
import type { McpProviderAdapter } from "./mcp.provider.js";
import { composioAdapter, isWriteToolName } from "./mcp.provider.composio.js";

const AGENT_ENUM_BY_SLUG: Record<AgentSlug, Agent> = {
  vega: Agent.VEGA,
  maya: Agent.MAYA,
  sage: Agent.SAGE,
  scout: Agent.SCOUT,
  rex: Agent.REX,
  lex: Agent.LEX,
};

const AGENT_SLUG_BY_ENUM: Record<Agent, AgentSlug> = {
  VEGA: "vega",
  MAYA: "maya",
  SAGE: "sage",
  SCOUT: "scout",
  REX: "rex",
  LEX: "lex",
};

const PROVIDER_ADAPTER_BY_ENUM: Record<McpProvider, McpProviderAdapter> = {
  COMPOSIO: composioAdapter,
};

const providerEnumForEntry = (_entry: IntegrationCatalogEntry): McpProvider =>
  McpProvider.COMPOSIO;

const getProviderAdapter = (entry: IntegrationCatalogEntry): McpProviderAdapter =>
  PROVIDER_ADAPTER_BY_ENUM[providerEnumForEntry(entry)];

const toolkitSlugForEntry = (entry: IntegrationCatalogEntry): string =>
  entry.composio!.toolkitSlug;

const requireCatalogEntry = (slug: string): IntegrationCatalogEntry => {
  const entry = getIntegrationBySlug(slug);
  if (!entry) throw new NotFoundError(`Unknown integration "${slug}"`);
  if (entry.status !== "composio") {
    throw new BadRequestError(`"${entry.name}" isn't connectable yet — coming soon.`);
  }
  return entry;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Best-effort extraction of a wait duration from a provider's rate-limit
// error text, e.g. Reddit's Composio error: "[['RATELIMIT', '5 seconds',
// 'ratelimit']]". Returns null when the message isn't rate-limit-shaped or
// no duration could be parsed, in which case the caller should not retry.
const parseRateLimitWaitMs = (message: string): number | null => {
  if (!/rate.?limit/i.test(message)) return null;
  const match = message.match(/(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?|m|mins?|minutes?)\b/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("ms") || unit.startsWith("milli")) return value;
  if (unit.startsWith("m") && !unit.startsWith("ms") && !unit.startsWith("milli")) return value * 60_000;
  return value * 1000;
};

const notifyAiCacheInvalidate = async (organizationId: string): Promise<void> => {
  try {
    await aiService.post("/ai/mcp/invalidate-cache", { organization_id: organizationId });
  } catch (err) {
    // Best-effort — worst case the AI service's tool-list cache serves a
    // stale view for up to its TTL, not a hard failure.
    console.error("[mcp] ai cache invalidation failed (continuing)", err);
  }
};

export const listConnections = async (organizationId: string): Promise<McpConnectionSummary[]> => {
  const rows = await repo.findByOrg(organizationId);
  return rows.map((row) => ({
    slug: row.integrationSlug,
    connectionId: row.connectionId,
    toolkitSlug: row.toolkitSlug,
    ownerAgent: row.ownerAgent,
    status: row.status,
    lastConnectedAt: row.lastConnectedAt,
    lastError: row.lastError,
  }));
};

export const getConfigSchema = async (slug: string) => {
  const entry = requireCatalogEntry(slug);
  return getProviderAdapter(entry).getConfigSchema(entry);
};

export interface ConnectArgs {
  organizationId: string;
  userId: string;
  slug: string;
  configValues?: Record<string, unknown>;
}

export const connect = async ({ organizationId, userId, slug, configValues }: ConnectArgs): Promise<ConnectResult> => {
  const entry = requireCatalogEntry(slug);
  const adapter = getProviderAdapter(entry);
  const provider = providerEnumForEntry(entry);
  const toolkitSlug = toolkitSlugForEntry(entry);
  const existing = await repo.findByOrgAndSlug(organizationId, slug);

  try {
    const result = await adapter.connect({
      entry,
      organizationId,
      existingConnectionId: existing?.connectionId,
      configValues,
    });

    await repo.upsert({
      organizationId,
      integrationSlug: slug,
      connectionId: result.connectionId,
      toolkitSlug,
      provider,
      ownerAgent: AGENT_ENUM_BY_SLUG[entry.primaryAgent],
      status: result.dbStatus,
      connectedByUserId: userId,
      lastError: result.dbStatus === McpConnectionStatus.ERROR ? (result.message ?? "Connection failed") : null,
    });

    if (result.apiStatus === "connected") {
      await notifyAiCacheInvalidate(organizationId);
    }
    return { status: result.apiStatus, setupUrl: result.setupUrl, message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repo.upsert({
      organizationId,
      integrationSlug: slug,
      // No provider connectionId was returned — reuse any existing row's id,
      // or synthesize a placeholder so the unique constraint still upserts.
      connectionId: existing?.connectionId ?? `failed_${crypto.randomUUID()}`,
      toolkitSlug,
      provider,
      ownerAgent: AGENT_ENUM_BY_SLUG[entry.primaryAgent],
      status: McpConnectionStatus.ERROR,
      connectedByUserId: userId,
      lastError: message,
    });
    return { status: "error", message };
  }
};

export const refreshStatus = async (organizationId: string, slug: string): Promise<McpConnectionSummary> => {
  const row = await repo.findByOrgAndSlug(organizationId, slug);
  if (!row) throw new NotFoundError("No connection found for this integration");

  const adapter = PROVIDER_ADAPTER_BY_ENUM[row.provider];
  const { dbStatus, lastError } = await adapter.refreshStatus(row.connectionId);
  const updated = await repo.updateStatus(organizationId, slug, { status: dbStatus, lastError: lastError ?? null });

  if (dbStatus === McpConnectionStatus.CONNECTED && row.status !== McpConnectionStatus.CONNECTED) {
    await notifyAiCacheInvalidate(organizationId);
  }

  return {
    slug: updated.integrationSlug,
    connectionId: updated.connectionId,
    toolkitSlug: updated.toolkitSlug,
    ownerAgent: updated.ownerAgent,
    status: updated.status,
    lastConnectedAt: updated.lastConnectedAt,
    lastError: updated.lastError,
  };
};

export const disconnect = async (organizationId: string, slug: string): Promise<void> => {
  const row = await repo.findByOrgAndSlug(organizationId, slug);
  if (!row) throw new NotFoundError("No connection found for this integration");

  const adapter = PROVIDER_ADAPTER_BY_ENUM[row.provider];
  try {
    await adapter.disconnect(row.connectionId);
  } catch (err) {
    console.error(`[mcp] ${row.provider.toLowerCase()} disconnect failed (continuing)`, err);
  }
  await repo.remove(organizationId, slug);
  await notifyAiCacheInvalidate(organizationId);
};

/**
 * Called by contextService.ts's callAgentWithContext() before every agent
 * turn — resolves which of the org's CONNECTED integrations this agent can
 * use. Cheap no-op (no provider call) when the org has zero connections.
 * Provider-blind by design — apps/ai never needs to know which provider
 * backs a connection.
 */
/**
 * The agent's Composio integrations, each flagged with whether this org has
 * connected it. Lets an agent answer "what can you connect to?" and gives the
 * planner the exact set it is allowed to plan against.
 *
 * Shared by contextService (per chat turn) and the run planner so the two can
 * never disagree about what is connected.
 */
export const getCatalogForAgent = (
  agentEnum: Agent,
  connections: { integrationSlug: string }[],
): { slug: string; name: string; connected: boolean; agents: string[] }[] => {
  const connectedSlugs = new Set(connections.map((c) => c.integrationSlug));
  return getIntegrationsByAgent(agentEnum.toLowerCase() as AgentSlug)
    .filter((e) => e.status === "composio")
    .map((e) => ({
      slug: e.slug,
      name: e.name,
      connected: connectedSlugs.has(e.slug),
      // Which agents can actually reach this integration. The team planner
      // needs it: an integration being connected does not mean any agent may
      // use it, and assigning a Google Docs step to Vega produces a step that
      // cannot run, since Docs belongs to Lex.
      agents: [...e.agents],
    }));
};

export const getConnectionsForAgent = async (
  organizationId: string,
  agentEnum: Agent
): Promise<McpConnectionRef[]> => {
  const rows = await repo.findConnectedByOrg(organizationId);
  if (rows.length === 0) return [];

  const agentSlug = AGENT_SLUG_BY_ENUM[agentEnum];
  const ownedSlugs = new Set(getIntegrationsByAgent(agentSlug).map((e) => e.slug));

  return rows
    .filter((row) => ownedSlugs.has(row.integrationSlug))
    .map((row) => ({
      connectionId: row.connectionId,
      toolkitSlug: row.toolkitSlug,
      integrationSlug: row.integrationSlug,
    }));
};

/**
 * Internal (apps/ai) — list tools for one connection. Node holds the
 * provider's master key exclusively; Python never talks to Composio
 * directly.
 */
/**
 * A toolkit's catalog is the same for everyone. `listTools` resolves against
 * the toolkit slug alone (see composioAdapter.listTools) — a connection's
 * granted scopes affect whether a *call* succeeds, not which tools exist — so
 * Slack's 167 definitions are byte-identical for every org, agent and user.
 *
 * Caching per (org, agent) therefore re-fetched the same 233 KB repeatedly.
 * Keyed by toolkit instead, one fetch serves the entire deployment, and the
 * TTL can be long because catalogs only change when Composio ships new tools.
 */
type ToolCatalog = Awaited<ReturnType<McpProviderAdapter["listTools"]>>;

/** In-process tier. Serves the overwhelming majority of reads at no cost. */
const TOOL_CATALOG_MEMORY_TTL_MS = 6 * 60 * 60 * 1000;
/** Database tier. Longer, because it exists to survive restarts and deploys. */
const TOOL_CATALOG_DB_TTL_MS = 24 * 60 * 60 * 1000;
const toolCatalogCache = new Map<string, { expiresAt: number; tools: ToolCatalog }>();

export const listToolsForConnection = async (
  organizationId: string,
  connectionId: string,
): Promise<ToolCatalog> => {
  const row = await repo.findByConnectionId(connectionId);
  if (!row || row.organizationId !== organizationId) {
    // Never leak whether a connectionId exists for a DIFFERENT org. This check
    // stays ahead of both caches: they are shared across orgs, so skipping the
    // lookup would turn a shared catalog into a tenancy hole.
    throw new NotFoundError("Connection not found");
  }

  const cacheKey = `${row.provider}:${row.toolkitSlug}`;
  const memoryHit = toolCatalogCache.get(cacheKey);
  if (memoryHit && Date.now() < memoryHit.expiresAt) return memoryHit.tools;

  // Second tier: survives restarts and is shared between instances. Only read
  // on a memory miss — deserializing 233 KB on every chat turn would cost more
  // than the API call it saves.
  const stored = await repo.findToolCatalog(row.toolkitSlug);
  if (stored && Date.now() - stored.fetchedAt.getTime() < TOOL_CATALOG_DB_TTL_MS) {
    const tools = stored.tools as ToolCatalog;
    toolCatalogCache.set(cacheKey, {
      expiresAt: Date.now() + TOOL_CATALOG_MEMORY_TTL_MS,
      tools,
    });
    return tools;
  }

  const adapter = PROVIDER_ADAPTER_BY_ENUM[row.provider];
  const tools = await adapter.listTools({ toolkitSlug: row.toolkitSlug, connectionId });
  toolCatalogCache.set(cacheKey, {
    expiresAt: Date.now() + TOOL_CATALOG_MEMORY_TTL_MS,
    tools,
  });
  // Best-effort: a catalog that fails to persist costs one refetch next time,
  // not a failed chat turn.
  await repo
    .upsertToolCatalog(row.toolkitSlug, row.provider, tools)
    .catch((err) => console.error("[mcp] tool catalog persist failed", err));
  return tools;
};

/**
 * Internal (apps/ai) — call one tool on one connection. `connectionId` must
 * belong to `organizationId` — this is the enforced tenancy boundary: apps/ai
 * never talks to a provider directly or supplies a connectionId Node hasn't
 * already verified against this org.
 */
export const callTool = async (
  organizationId: string,
  connectionId: string,
  toolName: string,
  args: Record<string, unknown>
) => {
  const row = await repo.findByConnectionId(connectionId);
  if (!row || row.organizationId !== organizationId) {
    throw new NotFoundError("Connection not found");
  }
  const adapter = PROVIDER_ADAPTER_BY_ENUM[row.provider];
  // Single choke point for every provider-bound call, so the action log can't
  // drift out of sync with what actually happened — both the agent tool loop
  // and confirmed pending actions route through here.
  const started = Date.now();
  try {
    const result = await adapter.callTool({
      organizationId, connectionId, toolkitSlug: row.toolkitSlug, toolName, args,
    });
    void recordAction({
      organizationId,
      agent: row.ownerAgent,
      integrationSlug: row.integrationSlug,
      toolkitSlug: row.toolkitSlug,
      toolName,
      successful: true,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (err) {
    void recordAction({
      organizationId,
      agent: row.ownerAgent,
      integrationSlug: row.integrationSlug,
      toolkitSlug: row.toolkitSlug,
      toolName,
      successful: false,
      durationMs: Date.now() - started,
    });
    throw err;
  }
};

// ─── Proof of sight ────────────────────────────────────────────────────────
// The moment right after OAuth is the only one where a user is actively
// wondering whether this worked. Spending it on a green check wastes it, so
// a read-only call runs immediately and quotes their own data back.

/** Keys a provider might nest a countable list under, deepest-value-first. */
const PROOF_LIST_KEYS = [
  "items", "messages", "events", "channels", "files", "records",
  "results", "pages", "issues", "customers", "charges", "bases", "tasks", "data",
];

/** Walks a provider response for the first list that looks like the payload.
 *  Bounded depth: responses nest (Composio wraps everything under `data`), but
 *  an unbounded walk on a large result is a needless hot loop. */
const findCountableList = (value: unknown, depth = 0): unknown[] | null => {
  if (Array.isArray(value)) return value;
  if (depth >= 4 || value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of PROOF_LIST_KEYS) {
    const found = findCountableList(record[key], depth + 1);
    if (found) return found;
  }
  return null;
};

/** Keys carrying the *total* matching count rather than the returned page —
 *  Gmail sends resultSizeEstimate, most others some spelling of "total". */
const PROOF_TOTAL_KEYS = [
  "resultSizeEstimate", "totalResults", "totalCount", "total_count",
  "totalSize", "total", "count",
];

/**
 * Finds the real total behind a paged result, so the headline can read
 * "2,113 emails" instead of "25+ emails" — the page size we happened to ask
 * for is not a fact about the user's business, and it's the fact that makes
 * this screen land.
 *
 * Only accepts a value at least as large as the page we got back: a smaller
 * "count" means the key meant something else entirely (a per-item count, a
 * page number), and reporting it would understate what we can see.
 */
const findTotalCount = (value: unknown, atLeast: number, depth = 0): number | null => {
  if (depth >= 4 || value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of PROOF_TOTAL_KEYS) {
    const candidate = record[key];
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= atLeast) {
      return Math.floor(candidate);
    }
  }
  for (const key of PROOF_LIST_KEYS) {
    const found = findTotalCount(record[key], atLeast, depth + 1);
    if (found !== null) return found;
  }
  return null;
};

export interface ProofResult {
  /** Human-readable line, e.g. "1,847 emails". Absent when nothing countable came back. */
  headline?: string;
  /** How many actions this connection exposes — always available. */
  toolCount: number;
  integrationName: string;
}

/**
 * Runs an integration's ProofSpec against a freshly-connected account.
 *
 * Every failure path degrades to the tool count rather than throwing: this
 * runs on the success screen of a connect flow that has *already* succeeded,
 * so a failed proof read must never make a working connection look broken.
 */
export const getConnectionProof = async (
  organizationId: string,
  slug: string,
): Promise<ProofResult> => {
  const entry = requireCatalogEntry(slug);
  const row = await repo.findByOrgAndSlug(organizationId, slug);
  if (!row) throw new NotFoundError("Connection not found");

  const adapter = getProviderAdapter(entry);
  const tools = await adapter.listTools({ toolkitSlug: row.toolkitSlug, connectionId: row.connectionId });
  const base: ProofResult = { toolCount: tools.length, integrationName: entry.name };

  const spec = entry.proof;
  if (!spec) return base;

  // Resolve the spec's intent against tools that genuinely exist on this
  // connection, so a stale fragment degrades instead of erroring at call time.
  const readableTools = tools.filter((t) => !t.isWrite);
  const match = spec.toolMatch
    .map((fragment) =>
      readableTools.find((t) => t.name.toUpperCase().includes(fragment.toUpperCase())),
    )
    .find(Boolean);
  if (!match) return base;

  try {
    const result = await adapter.callTool({
      organizationId,
      connectionId: row.connectionId,
      toolkitSlug: row.toolkitSlug,
      toolName: match.name,
      args: spec.args ?? {},
    });
    const list = findCountableList(result);
    if (!list) return base;
    // Prefer the provider's own total over the page we asked for; only fall
    // back to "25+" when the response carries no total at all.
    const total = findTotalCount(result, list.length);
    const count = total ?? list.length;
    const approximate = total === null && list.length >= (Number(spec.args?.max_results) || 25);
    return {
      ...base,
      headline: `${count.toLocaleString("en-US")}${approximate ? "+" : ""} ${spec.noun}`,
    };
  } catch (err) {
    console.error("[mcp] proof read failed (falling back to tool count)", slug, err);
    return base;
  }
};

// ─── Action log ────────────────────────────────────────────────────────────

/**
 * Records one executed provider call. Fire-and-forget by design: an agent's
 * real work must never fail because bookkeeping did, so every error is
 * swallowed after logging — the same contract as activity.service.ts.
 *
 * isWrite is derived from the tool slug via the provider's own classifier so
 * the log agrees with the confirm-before-execute gate that used it.
 */
const recordAction = async (input: {
  organizationId: string;
  agent: Agent | null;
  integrationSlug: string;
  /** Provider-side toolkit slug — the tool prefix, which differs from the
   *  catalog slug (catalog "google-calendar" vs. toolkit "googlecalendar"). */
  toolkitSlug: string;
  toolName: string;
  successful: boolean;
  durationMs: number;
}): Promise<void> => {
  try {
    await prisma.mcpActionLog.create({
      data: {
        organizationId: input.organizationId,
        agent: input.agent,
        integrationSlug: input.integrationSlug,
        toolName: input.toolName,
        isWrite: isWriteToolName(input.toolName, input.toolkitSlug),
        successful: input.successful,
        durationMs: input.durationMs,
      },
    });
  } catch (err) {
    console.error("[mcp] action log write failed (continuing)", err);
  }
};

// ─── Value report ──────────────────────────────────────────────────────────

export interface ValueReport {
  /** Days the window covers. */
  periodDays: number;
  /** Successful provider calls in the window. */
  actions: number;
  /** Of those, calls that changed something in a connected system. */
  writes: number;
  /** Distinct systems touched — the cross-system claim, stated honestly. */
  systemsTouched: number;
  /** Busiest integrations first. */
  breakdown: Array<{ slug: string; name: string; actions: number }>;
  /** Null until the log has run long enough to mean anything (see below). */
  hoursSaved: number | null;
}

// Minutes of manual work a single cross-system action replaces. Deliberately
// conservative: this number ends up in front of a customer deciding whether to
// renew, so it should read as obviously defensible rather than impressive.
const MINUTES_SAVED_PER_ACTION = 2;

// The log starts empty at deploy, so an org's first report would otherwise
// claim near-zero value for a month they actually used the product. Below this
// count we return null and the UI says "still measuring" instead of a
// misleading figure.
const MIN_ACTIONS_FOR_ESTIMATE = 10;

export const getValueReport = async (
  organizationId: string,
  periodDays = 30,
): Promise<ValueReport> => {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const { total, writes, byIntegration } = await repo.summarizeActions(organizationId, since);

  const breakdown = byIntegration.map((row) => ({
    slug: row.integrationSlug,
    name: getIntegrationBySlug(row.integrationSlug)?.name ?? row.integrationSlug,
    actions: row._count._all,
  }));

  return {
    periodDays,
    actions: total,
    writes,
    systemsTouched: byIntegration.length,
    breakdown,
    hoursSaved:
      total >= MIN_ACTIONS_FOR_ESTIMATE
        ? Math.round((total * MINUTES_SAVED_PER_ACTION) / 60)
        : null,
  };
};

// ─── Approval policy ───────────────────────────────────────────────────────

export interface ApprovalPolicyEntry {
  id: string;
  integrationSlug: string;
  toolName: string;
  mode: McpApprovalMode;
  createdAt: string;
}

const WILDCARD = "*";

/**
 * What should happen to a proposed write. Most specific rule wins: a rule for
 * this exact tool beats one for the integration, which beats an org-wide one.
 *
 * No rule means ALWAYS_ASK. That default is the product's central promise, so
 * it is expressed as "absence means ask" rather than a seeded row — a policy
 * table that fails to load cannot accidentally authorise anything.
 */
export const resolveApprovalMode = async (
  organizationId: string,
  integrationSlug: string,
  toolName: string,
): Promise<McpApprovalMode> => {
  const rules = await prisma.mcpApprovalPolicy.findMany({
    where: {
      organizationId,
      OR: [
        { integrationSlug, toolName },
        { integrationSlug, toolName: WILDCARD },
        { integrationSlug: WILDCARD, toolName: WILDCARD },
      ],
    },
  });
  if (rules.length === 0) return McpApprovalMode.ALWAYS_ASK;

  const specificity = (r: { integrationSlug: string; toolName: string }) =>
    (r.integrationSlug === WILDCARD ? 0 : 2) + (r.toolName === WILDCARD ? 0 : 1);
  return rules.sort((a, b) => specificity(b) - specificity(a))[0]!.mode;
};

export const listApprovalPolicies = async (
  organizationId: string,
): Promise<ApprovalPolicyEntry[]> => {
  const rows = await prisma.mcpApprovalPolicy.findMany({
    where: { organizationId },
    orderBy: [{ integrationSlug: "asc" }, { toolName: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    integrationSlug: r.integrationSlug,
    toolName: r.toolName,
    mode: r.mode,
    createdAt: r.createdAt.toISOString(),
  }));
};

export const setApprovalPolicy = async (params: {
  organizationId: string;
  userId: string;
  integrationSlug?: string;
  toolName?: string;
  mode: McpApprovalMode;
}): Promise<ApprovalPolicyEntry> => {
  const integrationSlug = params.integrationSlug ?? WILDCARD;
  const toolName = params.toolName ?? WILDCARD;
  const row = await prisma.mcpApprovalPolicy.upsert({
    where: {
      organizationId_integrationSlug_toolName: {
        organizationId: params.organizationId,
        integrationSlug,
        toolName,
      },
    },
    create: {
      organizationId: params.organizationId,
      integrationSlug,
      toolName,
      mode: params.mode,
      createdByUserId: params.userId,
    },
    update: { mode: params.mode, createdByUserId: params.userId },
  });
  return {
    id: row.id,
    integrationSlug: row.integrationSlug,
    toolName: row.toolName,
    mode: row.mode,
    createdAt: row.createdAt.toISOString(),
  };
};

export const deleteApprovalPolicy = async (
  organizationId: string,
  id: string,
): Promise<void> => {
  const row = await prisma.mcpApprovalPolicy.findUnique({ where: { id } });
  if (!row || row.organizationId !== organizationId) {
    throw new NotFoundError("Rule not found");
  }
  await prisma.mcpApprovalPolicy.delete({ where: { id } });
};

// ─── Customer-facing audit log ─────────────────────────────────────────────

export interface ActionLogEntry {
  id: string;
  /** Integration name as the customer knows it, not the slug. */
  integration: string;
  integrationSlug: string;
  agent: Agent | null;
  /** The tool slug, tidied for reading: GMAIL_SEND_EMAIL -> "Send email". */
  action: string;
  isWrite: boolean;
  successful: boolean;
  durationMs: number | null;
  at: string;
}

export interface ActionLogPage {
  entries: ActionLogEntry[];
  /** Pass back as `before` to fetch the next page; null at the end. */
  nextCursor: string | null;
  /** Integrations present in this org's log, for the filter control. */
  integrations: { slug: string; name: string; count: number }[];
}

/**
 * Turns a provider tool slug into something a non-technical owner can read.
 * The toolkit prefix is dropped because the integration is already its own
 * column — "Gmail · Gmail send email" reads like a bug.
 */
const humanizeToolName = (toolName: string, integrationSlug: string): string => {
  const prefix = integrationSlug.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const withoutPrefix = toolName.replace(new RegExp(`^${prefix}_`, "i"), "");
  const words = withoutPrefix.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * The record of what agents actually did in the customer's own systems.
 *
 * Reads the same McpActionLog rows the value report counts — and inherits its
 * privacy stance: the log holds no arguments and no results, so this can show
 * that an email was sent without showing what it said.
 */
export const getActionLog = async (params: {
  organizationId: string;
  integrationSlug?: string;
  agent?: Agent;
  writesOnly?: boolean;
  failuresOnly?: boolean;
  before?: string;
  limit?: number;
}): Promise<ActionLogPage> => {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const [rows, grouped] = await Promise.all([
    repo.findActionLog({
      organizationId: params.organizationId,
      integrationSlug: params.integrationSlug,
      agent: params.agent,
      writesOnly: params.writesOnly,
      failuresOnly: params.failuresOnly,
      before: params.before ? new Date(params.before) : undefined,
      // One extra row decides whether there is a next page without a count query.
      limit: limit + 1,
    }),
    repo.findLoggedIntegrations(params.organizationId),
  ]);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    entries: page.map((row) => ({
      id: row.id,
      integration: getIntegrationBySlug(row.integrationSlug)?.name ?? row.integrationSlug,
      integrationSlug: row.integrationSlug,
      agent: row.agent,
      action: humanizeToolName(row.toolName, row.integrationSlug),
      isWrite: row.isWrite,
      successful: row.successful,
      durationMs: row.durationMs,
      at: row.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? page[page.length - 1]!.createdAt.toISOString() : null,
    integrations: grouped
      .map((g) => ({
        slug: g.integrationSlug,
        name: getIntegrationBySlug(g.integrationSlug)?.name ?? g.integrationSlug,
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count),
  };
};

// ─── Command Center ────────────────────────────────────────────────────────

export interface CommandCenterSummary {
  /** Staged actions waiting on a human — the only thing here that needs them. */
  pendingActionCount: number;
  /** Connected integrations, for the "N systems connected" line. */
  connectedCount: number;
  /** Successful provider calls in the last 24h, from the action log. */
  recentActionCount: number;
}

/**
 * What needs the owner, and what the agents have been doing.
 *
 * This used to fan out a live provider read per connected integration to show
 * "your business right now". It was removed: at fifteen connections a single
 * uncached dashboard load cost fifteen Composio calls, and a number on a
 * dashboard rarely changes what anyone does — the same question asked of an
 * agent gets a better answer with context.
 *
 * What remains is the part that was always the most useful and happens to be
 * free: the approval queue, which is exactly where triggers and plays deliver
 * their proposals, read entirely from our own database. This endpoint makes no
 * provider calls at all.
 */
export const getCommandCenter = async (
  organizationId: string,
): Promise<CommandCenterSummary> => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [connections, pendingActionCount, recentActionCount] = await Promise.all([
    repo.findConnectedByOrg(organizationId),
    repo.countPendingActionsByOrg(organizationId),
    repo.countRecentActions(organizationId, since),
  ]);

  return {
    pendingActionCount,
    connectedCount: connections.length,
    recentActionCount,
  };
};


const toPendingActionSummary = (row: {
  id: string;
  agent: Agent;
  integrationSlug: string;
  toolName: string;
  summary: string;
  status: McpPendingActionStatus;
  resultJson: unknown;
  errorMessage: string | null;
}): McpPendingActionSummary => ({
  id: row.id,
  agent: row.agent,
  integrationSlug: row.integrationSlug,
  toolName: row.toolName,
  summary: row.summary,
  status: row.status,
  resultJson: row.resultJson,
  errorMessage: row.errorMessage,
});

/**
 * The one way to read staged write proposals off an agent response.
 *
 * apps/ai emits these at `metadata.pending_actions` (see agents/base.py's
 * mcp_pending_actions). Two callers previously read `mcp_pending_actions` off
 * the top level instead, which could never work: it is both the wrong key and
 * a key `chatResponseSchema` strips, since zod drops unknown properties. That
 * silently disabled write proposals for every trigger and play. Centralised
 * here so the mistake cannot be made a ninth time.
 */
export const readPendingActions = (
  response: { metadata?: Record<string, unknown> | null } | null | undefined,
): RawPendingAction[] =>
  (response?.metadata?.pending_actions as RawPendingAction[] | undefined) ?? [];

/** Lightweight snapshot each agent's *.service.ts stores on Message.customInput
 * so the chat UI can render pending-action cards without an extra fetch. */
export const toPendingActionsSnapshot = (pendingActions: RawPendingAction[]) =>
  pendingActions.map((a) => ({ id: a.id, summary: a.summary, status: "PENDING" as const }));

/**
 * Attaches the turn's tool trace to whatever customInput an agent service
 * already built, so the chat UI can show which systems were touched.
 *
 * Deliberately a merge rather than a builder: every agent service composes
 * customInput differently (Maya folds in images, Lex folds in raw metadata),
 * so this preserves each one's own shape and only adds a key. Returns the
 * input untouched when there's no trace — an empty trace must not force an
 * otherwise-undefined customInput into existence, which would make every
 * plain conversational reply carry a needless JSON blob.
 */
export const withToolTrace = (
  customInput: Record<string, unknown> | undefined,
  toolTrace: ToolTraceEntry[] | undefined,
): Record<string, unknown> | undefined =>
  toolTrace?.length ? { ...(customInput ?? {}), toolTrace } : customInput;

/**
 * Called by each agent's *.service.ts right after it persists the assistant
 * Message — stages the write-capable MCP tool calls apps/ai proposed but did
 * NOT execute (see agents/base.py's mcp_pending_actions), so the user can
 * confirm or reject each one from the chat UI.
 */
export const stagePendingActions = async (params: {
  organizationId: string;
  userId: string;
  agent: Agent;
  messageId: string;
  pendingActions: RawPendingAction[];
  /** Omitted for chat turns; TRIGGER marks an action proposed with nobody watching. */
  source?: McpActionSource;
  triggerEventId?: string;
}): Promise<void> => {
  if (params.pendingActions.length === 0) return;
  const connectionIds = [...new Set(params.pendingActions.map((a) => a.connection_id))];
  const connections = await repo.findManyByConnectionIds(params.organizationId, connectionIds);
  const integrationSlugByConnectionId = new Map(connections.map((c) => [c.connectionId, c.integrationSlug]));

  await repo.createPendingActions(
    params.pendingActions.map((a) => ({
      id: a.id,
      organizationId: params.organizationId,
      userId: params.userId,
      agent: params.agent,
      messageId: params.messageId,
      connectionId: a.connection_id,
      integrationSlug: integrationSlugByConnectionId.get(a.connection_id) ?? "",
      toolName: a.tool_name,
      arguments: a.arguments,
      summary: a.summary,
      source: params.source,
      triggerEventId: params.triggerEventId,
    }))
  );

  // Rows exist first, then policy is applied to each — so an action that gets
  // auto-run or blocked still leaves the same audit trail as one a human
  // decided on, rather than vanishing before it was ever recorded.
  await Promise.all(
    params.pendingActions.map(async (a) => {
      const integrationSlug = integrationSlugByConnectionId.get(a.connection_id) ?? "";
      const mode = await resolveApprovalMode(params.organizationId, integrationSlug, a.tool_name);
      if (mode === McpApprovalMode.ALWAYS_ASK) return;

      if (mode === McpApprovalMode.NEVER) {
        await repo.updatePendingActionStatus(a.id, {
          status: McpPendingActionStatus.REJECTED,
          errorMessage: "Blocked by your approval rules",
        });
        return;
      }

      try {
        const result = await callTool(
          params.organizationId,
          a.connection_id,
          a.tool_name,
          a.arguments,
        );
        await repo.updatePendingActionStatus(a.id, {
          status: McpPendingActionStatus.EXECUTED,
          resultJson: result,
        });
      } catch (err) {
        await repo.updatePendingActionStatus(a.id, {
          status: McpPendingActionStatus.FAILED,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );
};

const requirePendingAction = async (organizationId: string, id: string) => {
  const row = await repo.findPendingActionById(id);
  if (!row || row.organizationId !== organizationId) {
    throw new NotFoundError("Pending action not found");
  }
  if (row.status !== McpPendingActionStatus.PENDING) {
    throw new BadRequestError(`Action already ${row.status.toLowerCase()}`);
  }
  return row;
};

/**
 * Live status lookup — no PENDING guard, unlike confirm/reject. Lets the
 * frontend show the real current state on page load/refresh instead of the
 * stale PENDING snapshot baked into Message.customInput at staging time.
 */
export const getPendingAction = async (
  organizationId: string,
  id: string
): Promise<McpPendingActionSummary> => {
  const row = await repo.findPendingActionById(id);
  if (!row || row.organizationId !== organizationId) {
    throw new NotFoundError("Pending action not found");
  }
  return toPendingActionSummary(row);
};

export const confirmPendingAction = async (
  organizationId: string,
  id: string
): Promise<McpPendingActionSummary> => {
  const row = await requirePendingAction(organizationId, id);
  const MAX_RATE_LIMIT_RETRIES = 2;
  const MAX_AUTO_WAIT_MS = 15_000; // don't hold the request open longer than this per wait

  for (let attempt = 0; ; attempt++) {
    try {
      const result = await callTool(
        organizationId,
        row.connectionId,
        row.toolName,
        row.arguments as Record<string, unknown>
      );
      // Composio's tool.execute() often reports business-logic-level failures
      // (permission denied, plan limits, validation errors, rate limits, ...)
      // as a normal 200 response shaped { data, error, successful: false }
      // rather than throwing — verified live (Calendly's paid-plan-only
      // Scheduling API, Reddit's rate limiter both return this shape).
      const isComposioFailure =
        typeof result === "object" && result !== null && (result as { successful?: unknown }).successful === false;
      if (isComposioFailure) {
        const composioError = (result as { error?: unknown }).error;
        const errorMessage = typeof composioError === "string" ? composioError : "Action failed";
        const waitMs = parseRateLimitWaitMs(errorMessage);
        if (waitMs !== null && waitMs <= MAX_AUTO_WAIT_MS && attempt < MAX_RATE_LIMIT_RETRIES) {
          await sleep(waitMs);
          continue; // retry the same tool call
        }
        const updated = await repo.updatePendingActionStatus(id, {
          status: McpPendingActionStatus.FAILED,
          resultJson: result,
          errorMessage,
        });
        return toPendingActionSummary(updated);
      }
      const updated = await repo.updatePendingActionStatus(id, {
        status: McpPendingActionStatus.EXECUTED,
        resultJson: result,
      });
      return toPendingActionSummary(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const updated = await repo.updatePendingActionStatus(id, {
        status: McpPendingActionStatus.FAILED,
        errorMessage: message,
      });
      return toPendingActionSummary(updated);
    }
  }
};

export const rejectPendingAction = async (
  organizationId: string,
  id: string
): Promise<McpPendingActionSummary> => {
  await requirePendingAction(organizationId, id);
  const updated = await repo.updatePendingActionStatus(id, { status: McpPendingActionStatus.REJECTED });
  return toPendingActionSummary(updated);
};

// --- Per-agent MCP tool preference ---

const requireAgentSlug = (agentSlug: string): AgentSlug => {
  if (!(agentSlug in AGENT_ENUM_BY_SLUG)) {
    throw new BadRequestError(`Unknown agent "${agentSlug}"`);
  }
  return agentSlug as AgentSlug;
};

export const getToolPreference = async (
  organizationId: string,
  agentSlug: string
): Promise<{ preferredIntegrationSlug: string | null }> => {
  const agent = AGENT_ENUM_BY_SLUG[requireAgentSlug(agentSlug)];
  const row = await repo.findToolPreference(organizationId, agent);
  return { preferredIntegrationSlug: row?.preferredIntegrationSlug ?? null };
};

export const setToolPreference = async (
  organizationId: string,
  agentSlug: string,
  preferredIntegrationSlug: string | null
): Promise<{ preferredIntegrationSlug: string | null }> => {
  const agent = AGENT_ENUM_BY_SLUG[requireAgentSlug(agentSlug)];
  const row = await repo.upsertToolPreference(organizationId, agent, preferredIntegrationSlug);
  return { preferredIntegrationSlug: row.preferredIntegrationSlug };
};
