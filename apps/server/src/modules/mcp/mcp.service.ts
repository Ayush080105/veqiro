import { BadRequestError } from "../../common/errors/badRequest.js";
import { NotFoundError } from "../../common/errors/notFound.js";
import { Agent, McpConnectionStatus, McpPendingActionStatus, McpProvider } from "../../../prisma/generated/prisma/client.js";
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
import { evaluateMetric, formatMetric, resolvePath } from "./mcp.metrics.js";
import {
  WIDGET_CATALOG,
  dateRangeLabel,
  evaluateWidget,
  resolveArgs,
  resolveInputArgs,
  widgetById,
  type WidgetKind,
  type WidgetResult,
  type WidgetRow,
} from "./mcp.widgets.js";

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
      invalidateSignals(organizationId);
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
    invalidateSignals(organizationId);
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
  invalidateSignals(organizationId);
};

/**
 * Called by contextService.ts's callAgentWithContext() before every agent
 * turn — resolves which of the org's CONNECTED integrations this agent can
 * use. Cheap no-op (no provider call) when the org has zero connections.
 * Provider-blind by design — apps/ai never needs to know which provider
 * backs a connection.
 */
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
export const listToolsForConnection = async (organizationId: string, connectionId: string) => {
  const row = await repo.findByConnectionId(connectionId);
  if (!row || row.organizationId !== organizationId) {
    // Never leak whether a connectionId exists for a DIFFERENT org.
    throw new NotFoundError("Connection not found");
  }
  const adapter = PROVIDER_ADAPTER_BY_ENUM[row.provider];
  return adapter.listTools({ toolkitSlug: row.toolkitSlug, connectionId });
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

// ─── Dashboard widgets ─────────────────────────────────────────────────────
// The customer picks business widgets ("Unread email", "Search clicks"), never
// tools or field paths — see mcp.widgets.ts for why that inversion matters.

export interface AvailableWidgetInput {
  name: string;
  label: string;
  placeholder?: string;
  /** Resolved from the customer's own account when the widget declares it. */
  options?: string[];
  /** Fixed labelled options (a date range). Value is a day count, not a date. */
  choices?: { value: string; label: string }[];
  /** Pre-selected value, so a widget with sensible defaults is one click. */
  defaultValue?: string;
}

export interface AvailableWidget {
  id: string;
  integrationSlug: string;
  integrationName: string;
  name: string;
  description: string;
  kind: WidgetKind;
  inputs: AvailableWidgetInput[];
}

/**
 * Widgets this org can add, for the systems it actually has connected.
 *
 * Input options are resolved live (e.g. the customer's Search Console
 * properties) so the picker offers a dropdown instead of asking them to paste
 * an identifier they'd have to go and look up.
 */
/**
 * Widgets this org can add, for the systems it actually has connected.
 *
 * Curated only, deliberately. Auto-discovering widgets from a provider's tool
 * list was built and measured against 14 live connections: even after filtering
 * out administrative tools and identifier-shaped titles, only 9 of 42
 * candidates rendered anything, and those still titled rows "INR",
 * "siteOwner" and "CHAT". A dashboard is the wrong place to guess, so coverage
 * grows by verifying one integration at a time in mcp.widgets.ts.
 *
 * Input options are resolved live (e.g. the customer's Search Console
 * properties) so the picker offers a dropdown instead of asking them to paste
 * an identifier they would have to go and look up.
 */
export const listAvailableWidgets = async (organizationId: string): Promise<AvailableWidget[]> => {
  const connections = await repo.findConnectedByOrg(organizationId);
  const bySlug = new Map(connections.map((c) => [c.integrationSlug, c]));

  return Promise.all(
    WIDGET_CATALOG.filter((widget) => bySlug.has(widget.integrationSlug)).map(async (widget) => {
      const row = bySlug.get(widget.integrationSlug)!;
      const entry = getIntegrationBySlug(widget.integrationSlug);
      const inputs: AvailableWidgetInput[] = [];
      for (const input of widget.inputs ?? []) {
        let options: string[] | undefined;
        if (input.optionsFrom) {
          try {
            const response = await withTimeout(
              callTool(organizationId, row.connectionId, input.optionsFrom.toolName, {}),
              SIGNAL_TIMEOUT_MS,
            );
            const values = resolvePath(response, input.optionsFrom.valuePath)
              .filter((v): v is string => typeof v === "string");
            if (values.length) options = values;
          } catch (err) {
            // Offer a free-text field rather than dropping the widget — the
            // customer may well know the value even if we could not list it.
            console.error("[mcp] widget option lookup failed", widget.id, input.name, err);
          }
        }
        inputs.push({
          name: input.name,
          label: input.label,
          placeholder: input.placeholder,
          options,
          choices: input.choices,
          // 28 days is the middle of the range list and what Search Console
          // itself defaults to, so it is the least surprising pre-selection.
          defaultValue: input.kind === "dateRange" ? "28" : undefined,
        });
      }
      return {
        id: widget.id,
        integrationSlug: widget.integrationSlug,
        integrationName: entry?.name ?? widget.integrationSlug,
        name: widget.name,
        description: widget.description,
        kind: widget.kind,
        inputs,
      };
    }),
  );
};

/** Falls back to a sensible value for any declared input a stored tile lacks. */
const defaultInputsFor = (widget: { inputs?: { name: string; kind?: string }[] }) => {
  const defaults: Record<string, unknown> = {};
  for (const input of widget.inputs ?? []) {
    if (input.kind === "dateRange") defaults[input.name] = "28";
  }
  return defaults;
};

/** Runs one widget for this org. Every caller (preview, dashboard) goes through
 *  here, so what the customer previews is exactly what gets pinned. */
export const runWidget = async (
  organizationId: string,
  widgetId: string,
  inputs: Record<string, unknown>,
): Promise<WidgetResult & { error?: string }> => {
  const widget = widgetById(widgetId);
  if (!widget) throw new NotFoundError(`Unknown widget "${widgetId}"`);
  // Tiles pinned before an input was introduced have no stored value for it.
  // Without this, a pre-existing Search Console tile called the API with no
  // start_date and silently produced nothing.
  const withDefaults = { ...defaultInputsFor(widget), ...inputs };
  const row = await repo.findByOrgAndSlug(organizationId, widget.integrationSlug);
  if (!row) throw new NotFoundError("Connection not found");
  try {
    const response = await withTimeout(
      callTool(organizationId, row.connectionId, widget.toolName, {
        ...resolveArgs(widget.args),
        ...resolveInputArgs(widget, withDefaults),
      }),
      SIGNAL_TIMEOUT_MS,
    );
    return evaluateWidget(widget, response);
  } catch (err) {
    return {
      kind: widget.kind,
      error: err instanceof Error ? err.message.slice(0, 200) : "Could not read this",
    };
  }
};

export interface DashboardTile {
  id: string;
  widgetId: string;
  integrationSlug: string;
  integrationName: string;
  /** The widget's name, or the customer's rename of it. */
  name: string;
  kind: WidgetKind;
  inputs: Record<string, unknown>;
  position: number;
}

const toDashboardTile = (row: {
  id: string; widgetId: string; integrationSlug: string;
  label: string | null; inputs: unknown; position: number;
}): DashboardTile | null => {
  const widget = widgetById(row.widgetId);
  // A tile whose widget no longer exists in the catalog is skipped rather than
  // rendered as a broken card.
  if (!widget) return null;
  return {
    id: row.id,
    widgetId: row.widgetId,
    integrationSlug: row.integrationSlug,
    integrationName: getIntegrationBySlug(row.integrationSlug)?.name ?? row.integrationSlug,
    name: row.label ?? widget.name,
    kind: widget.kind,
    inputs:
      row.inputs && typeof row.inputs === "object" && !Array.isArray(row.inputs)
        ? (row.inputs as Record<string, unknown>)
        : {},
    position: row.position,
  };
};

export const listTiles = async (organizationId: string): Promise<DashboardTile[]> => {
  const rows = await repo.findTilesByOrg(organizationId);
  return rows.map(toDashboardTile).filter((t): t is DashboardTile => t !== null);
};

export const addTile = async (
  organizationId: string,
  input: { widgetId: string; inputs?: Record<string, unknown>; label?: string | null },
): Promise<void> => {
  const widget = widgetById(input.widgetId);
  if (!widget) throw new NotFoundError(`Unknown widget "${input.widgetId}"`);
  // Every declared input must be supplied — a widget missing its site_url would
  // fail on every dashboard load with no way for the user to see why.
  for (const declared of widget.inputs ?? []) {
    const value = input.inputs?.[declared.name];
    if (value === undefined || value === null || value === "") {
      throw new BadRequestError(`"${declared.label}" is required for this widget`);
    }
  }
  // Same widget with different inputs is a legitimately different tile (clicks
  // for two Search Console properties), so uniqueness is (widget + inputs)
  // rather than a DB constraint on widgetId alone.
  const existingTiles = await repo.findTilesByOrg(organizationId);
  const alreadyPinned = existingTiles.some(
    (tile) => tile.widgetId === input.widgetId && sameInputs(tile.inputs, input.inputs ?? {}),
  );
  if (alreadyPinned) {
    throw new BadRequestError(`"${widget.name}" is already on your dashboard`);
  }

  const rangeInput = (widget.inputs ?? []).find((i) => i.kind === "dateRange");
  const chosenRange = rangeInput ? input.inputs?.[rangeInput.name] : undefined;
  const defaultLabel = chosenRange
    ? `${widget.name} · ${dateRangeLabel(String(chosenRange)).toLowerCase()}`
    : null;

  await repo.createTile({
    organizationId,
    widgetId: widget.id,
    integrationSlug: widget.integrationSlug,
    inputs: input.inputs ?? {},
    label: input.label ?? defaultLabel,
    position: existingTiles.length,
  });
  invalidateSignals(organizationId);
};

/** Order-insensitive comparison of two widget input maps. */
const sameInputs = (a: unknown, b: Record<string, unknown>): boolean => {
  const left = a && typeof a === "object" && !Array.isArray(a) ? (a as Record<string, unknown>) : {};
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(b);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => String(left[key]) === String(b[key]));
};

export const removeTile = async (organizationId: string, id: string): Promise<void> => {
  await repo.deleteTile(organizationId, id);
  invalidateSignals(organizationId);
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

// ─── Command Center signals ────────────────────────────────────────────────

export interface OrgSignal {
  /** Set when this tile could not be read. The tile still renders, saying so —
   *  silently dropping it makes the dashboard look broken with no explanation. */
  error?: string;
  /** Unique per tile — an org may pin the same widget with different inputs. */
  key: string;
  slug: string;
  /** Integration name, e.g. "Gmail". */
  name: string;
  /** The widget's name, or the customer's rename, e.g. "Unread email". */
  title: string;
  kind: WidgetKind;
  /** Formatted value for a metric widget, e.g. "273" or "17.6". */
  display?: string | null;
  /** Real rows for a list widget — the actual mail, meetings, or queries. */
  rows?: WidgetRow[];
  logoUrl?: string;
}

export interface CommandCenterSummary {
  signals: OrgSignal[];
  pendingActionCount: number;
  connectedCount: number;
  /** When the signals were actually read from the providers. */
  refreshedAt: string;
}

// Signals fan out one live provider call per connected integration, so a cache
// is needed to keep repeated loads (and multiple tabs) from hammering every
// provider. But this card claims to show "right now": at the original 5 minutes
// a mail sent seconds ago was invisible even after a page refresh, with nothing
// on screen admitting the data was old. One minute absorbs render bursts while
// keeping the claim honest, and forceRefresh below gives an explicit way out.
const SIGNALS_TTL_MS = 60 * 1000;
// Razorpay alone was measured at 7.95s; at the previous 8s budget a slow
// provider lost its tile entirely, and tiles run in parallel so they
// contend. Generous enough that a timeout means genuinely broken.
const SIGNAL_TIMEOUT_MS = 20_000;
const signalsCache = new Map<string, { expiresAt: number; signals: OrgSignal[]; refreshedAt: string }>();

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("signal timed out")), ms)),
  ]);

/**
 * The live "your business right now" strip on the dashboard.
 *
 * Reuses each integration's ProofSpec rather than defining a second read path:
 * the question the dashboard asks ("what can we see in here?") is the same one
 * the connect screen asks, so one spec serves both and there is one place to
 * fix when a provider changes shape.
 *
 * Every read is independently timed out and independently allowed to fail —
 * one slow or broken integration must never blank the whole dashboard.
 */
export const getCommandCenter = async (
  organizationId: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<CommandCenterSummary> => {
  const connections = await repo.findConnectedByOrg(organizationId);
  const pendingActionCount = await repo.countPendingActionsByOrg(organizationId);

  const cached = opts.forceRefresh ? undefined : signalsCache.get(organizationId);
  if (cached && Date.now() < cached.expiresAt) {
    return {
      signals: cached.signals,
      pendingActionCount,
      connectedCount: connections.length,
      refreshedAt: cached.refreshedAt,
    };
  }

  // What the org pinned wins. Only when they've pinned nothing do we fall back
  // to the curated proof specs, so the dashboard is useful on day one but stops
  // second-guessing the customer the moment they've expressed a preference.
  const tiles = await listTiles(organizationId);
  const connectedSlugs = new Set(connections.map((c) => c.integrationSlug));

  const readTile = async (tile: DashboardTile): Promise<OrgSignal | null> => {
    const entry = getIntegrationBySlug(tile.integrationSlug);
    if (!entry) return null;
    const result = await runWidget(organizationId, tile.widgetId, tile.inputs);
    const unreadable =
      result.error !== undefined ||
      (result.kind === "metric" && (result.display === null || result.display === undefined));
    if (unreadable) {
      return {
        key: tile.id,
        slug: entry.slug,
        name: entry.name,
        title: tile.name,
        kind: result.kind,
        error: result.error ?? "No data came back",
        logoUrl: entry.logoUrl,
      };
    }
    return {
      key: tile.id,
      slug: entry.slug,
      name: entry.name,
      title: tile.name,
      kind: result.kind,
      display: result.display,
      rows: result.rows,
      logoUrl: entry.logoUrl,
    };
  };

  const readCuratedDefault = async (integrationSlug: string): Promise<OrgSignal | null> => {
    const entry = getIntegrationBySlug(integrationSlug);
    if (!entry) return null;
    try {
      const proof = await withTimeout(
        getConnectionProof(organizationId, integrationSlug),
        SIGNAL_TIMEOUT_MS,
      );
      if (!proof.headline) return null;
      return {
        key: entry.slug,
        slug: entry.slug,
        name: entry.name,
        title: entry.name,
        kind: "metric",
        display: proof.headline,
        logoUrl: entry.logoUrl,
      };
    } catch (err) {
      console.error("[mcp] default signal read failed (skipping)", integrationSlug, err);
      return null;
    }
  };

  const results = tiles.length
    ? await Promise.all(
        // A tile for a since-disconnected integration is skipped rather than
        // deleted — reconnecting should bring the customer's choice back.
        tiles.filter((t) => connectedSlugs.has(t.integrationSlug)).map(readTile),
      )
    : await Promise.all(
        connections
          .filter((row) => getIntegrationBySlug(row.integrationSlug)?.proof)
          .map((row) => readCuratedDefault(row.integrationSlug)),
      );

  const signals = results.filter((s): s is OrgSignal => s !== null);
  const refreshedAt = new Date().toISOString();
  signalsCache.set(organizationId, { expiresAt: Date.now() + SIGNALS_TTL_MS, signals, refreshedAt });

  return { signals, pendingActionCount, connectedCount: connections.length, refreshedAt };
};

/** Dropped whenever connections change, so a newly connected system shows up
 *  on the dashboard immediately instead of after the TTL. */
export const invalidateSignals = (organizationId: string): void => {
  signalsCache.delete(organizationId);
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
    }))
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
