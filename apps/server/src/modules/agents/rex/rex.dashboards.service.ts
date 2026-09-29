/**
 * Rex dashboards.
 *
 * The AI service turns a prompt into widgets (each one read-only SQL + how to show it) and runs
 * them in DuckDB; this module stores the dashboard, its layout, and — crucially — every widget's
 * computed rows per filter state (RexDashboardResult). Everything a viewer sees comes from those
 * stored rows, keyed by `dataVersion` (a hash of the source data and the widget queries), so:
 *   - a public link never runs a query for an anonymous visitor, except the first time someone
 *     picks a filter combination, which is computed once, stored, and rate-limited;
 *   - when a linked sheet changes, one refresh recomputes everything and old rows are dropped.
 */
import { createHash, randomBytes } from "crypto";
import { prisma } from "../../../config/prisma.js";
import { Prisma } from "../../../../prisma/generated/prisma/client.js";
import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { NotFoundError } from "../../../common/errors/notFound.js";
import { deleteObject, uploadBuffer } from "../../../common/utils/r2.js";
import { parseBuffer, type RawTable } from "./rex.csv.js";
import { datasetPayloadForAI, parseDataset } from "./rex.service.js";
import { fetchLinkedSheet, resolveShareLink } from "./rex.links.js";

export const MAX_DATASETS = 5;
export const MAX_STORED_COMBINATIONS = 200;
const DATE_PRESETS = ["last_30d", "last_90d", "last_12m", "ytd"] as const;
const REFRESH_LOCK_MS = 5 * 60_000;
const STALE_SYNC_MS = 15 * 60_000;
// Generating a dashboard is a model call plus a query per widget, over files up to 50 MB.
const AI_TIMEOUT_MS = 180_000;

// ── Types shared with the AI service ────────────────────────────────────────

export interface FilterDef {
  id: string;
  label: string;
  table: string;
  column: string;
  type: "category" | "date_range";
  options?: string[] | null;
}

export interface WidgetDef {
  id: string;
  kind: "kpi" | "chart" | "table" | "text";
  title: string;
  sql: string | null;
  spec: Record<string, unknown>;
  layout: { x: number; y: number; w: number; h: number } | null;
  filterIds: string[];
}

interface WidgetResult {
  widget_id: string;
  state_key: string;
  columns: string[];
  rows: Record<string, unknown>[];
  truncated?: boolean;
  error?: string | null;
}

interface AiDashboardResponse {
  dashboard: { title: string; description: string; filters: FilterDef[]; widgets: WidgetDef[] };
  results: WidgetResult[];
  dropped: Array<{ title: string; error: string }>;
  rows_used: number;
  whole_file: boolean;
}

interface AiRunResponse {
  results: WidgetResult[];
  filter_options: Record<string, string[] | null>;
}

export type FilterState = Record<string, string>;

// ── Helpers ─────────────────────────────────────────────────────────────────

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 32);

/** Table names the widget SQL uses. Stable for the life of the dashboard. */
export function makeAliases(datasets: Array<{ id: string; name: string }>): Record<string, string> {
  const used = new Set<string>();
  const out: Record<string, string> = {};
  for (const ds of datasets) {
    let base = ds.name.toLowerCase().replace(/\.(csv|xlsx|xls|tsv)$/, "").replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "").slice(0, 40) || "data";
    if (/^\d/.test(base)) base = `t_${base}`;
    let alias = base;
    for (let i = 2; used.has(alias); i++) alias = `${base}_${i}`;
    used.add(alias);
    out[ds.id] = alias;
  }
  return out;
}

/** "all" for no filters; otherwise sorted JSON so the same state always hits the same rows. */
export function filterKey(state: FilterState): string {
  const entries = Object.entries(state).filter(([, v]) => v !== undefined && v !== "").sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : "all";
}

/** Keep only values the dashboard offers — a viewer can't send an arbitrary string to a query. */
export function validateState(filters: FilterDef[], state: FilterState): FilterState {
  const out: FilterState = {};
  for (const [id, value] of Object.entries(state)) {
    const f = filters.find((x) => x.id === id);
    if (!f || typeof value !== "string") throw new BadRequestError("Unknown filter");
    const ok = f.type === "date_range"
      ? (DATE_PRESETS as readonly string[]).includes(value)
      : (f.options ?? []).includes(value);
    if (!ok) throw new BadRequestError(`"${value}" is not an option for ${f.label}`);
    out[id] = value;
  }
  return out;
}

/** Every state computed ahead of time: no filter, and each single filter value. */
export function precomputedStates(filters: FilterDef[]): Array<{ key: string; values: FilterState }> {
  const states = [{ key: "all", values: {} as FilterState }];
  for (const f of filters) {
    const values = f.type === "date_range" ? [...DATE_PRESETS] : (f.options ?? []);
    for (const v of values) states.push({ key: filterKey({ [f.id]: v }), values: { [f.id]: v } });
  }
  return states;
}

type DashboardRow = Prisma.RexDashboardGetPayload<{ include: { widgets: true } }>;

const widgetDefs = (d: DashboardRow): WidgetDef[] =>
  d.widgets.map((w) => ({
    id: w.id, kind: w.kind as WidgetDef["kind"], title: w.title, sql: w.sql,
    spec: w.spec as Record<string, unknown>, layout: w.layout as WidgetDef["layout"], filterIds: w.filterIds,
  }));

async function findOwned(organizationId: string, id: string): Promise<DashboardRow> {
  const d = await prisma.rexDashboard.findFirst({ where: { id, organizationId }, include: { widgets: true } });
  if (!d) throw new NotFoundError("Dashboard not found");
  return d;
}

async function loadDatasets(organizationId: string, ids: string[]) {
  const rows = await prisma.rexDataset.findMany({ where: { organizationId, id: { in: ids } } });
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
}

/** What the AI service loads: each dataset's preview and a short-lived link to its file. */
async function sourcesFor(organizationId: string, datasetIds: string[], aliases: Record<string, string>) {
  const datasets = await loadDatasets(organizationId, datasetIds);
  const sources = [];
  for (const ds of datasets) {
    const payload = await datasetPayloadForAI(ds, organizationId);
    if (!payload) continue;
    sources.push({ alias: aliases[ds.id] ?? "data", name: ds.name, table: payload.table, ...payload.file });
  }
  if (sources.length === 0) throw new BadRequestError("None of the chosen datasets have any data.");
  return { sources, datasets };
}

function computeVersion(
  datasets: Array<{ id: string; contentHash: string | null; updatedAt: Date; meta: unknown }>,
  widgets: WidgetDef[],
  filters: FilterDef[],
): string {
  return sha({
    d: datasets.map((d) => [d.id, d.contentHash ?? ((d.meta as { rawTable?: RawTable } | null)?.rawTable?.fileKey) ?? d.updatedAt.toISOString()]),
    w: widgets.map((w) => [w.id, w.sql, [...w.filterIds].sort()]),
    f: filters.map((f) => [f.id, f.table, f.column, f.type]),
  });
}

async function storeResults(dashboardId: string, dataVersion: string, results: WidgetResult[]) {
  if (!results.length) return;
  await prisma.rexDashboardResult.createMany({
    data: results.map((r) => ({
      dashboardId, widgetId: r.widget_id, filterKey: r.state_key, dataVersion,
      columns: r.columns as Prisma.InputJsonValue, rows: r.rows as Prisma.InputJsonValue,
      error: r.error ?? null,
    })),
    skipDuplicates: true,
  });
}

async function readResults(dashboardId: string, dataVersion: string | null, key: string) {
  if (!dataVersion) return {};
  const rows = await prisma.rexDashboardResult.findMany({ where: { dashboardId, dataVersion, filterKey: key } });
  return Object.fromEntries(rows.map((r) => [r.widgetId, { columns: r.columns, rows: r.rows, error: r.error }]));
}

async function writeWidgets(tx: Prisma.TransactionClient, dashboardId: string, organizationId: string, widgets: WidgetDef[]) {
  await tx.rexDashboardWidget.deleteMany({ where: { dashboardId, id: { notIn: widgets.map((w) => w.id) } } });
  for (const w of widgets) {
    const data = {
      kind: w.kind, title: w.title, sql: w.sql, spec: w.spec as Prisma.InputJsonValue,
      layout: (w.layout ?? { x: 0, y: 0, w: 6, h: 4 }) as Prisma.InputJsonValue, filterIds: w.filterIds,
    };
    await tx.rexDashboardWidget.upsert({
      where: { id: w.id },
      create: { id: w.id, dashboardId, organizationId, ...data },
      update: data,
    });
  }
}

/** Widget ids are chosen by the model ("w1"), so they are namespaced per dashboard to stay unique. */
function namespaceIds(dashboardId: string, widgets: WidgetDef[], results: WidgetResult[]) {
  const prefix = `${dashboardId.slice(-8)}_`;
  const map = new Map<string, string>();
  for (const w of widgets) {
    const id = w.id.startsWith(prefix) ? w.id : `${prefix}${w.id}`.slice(0, 60);
    map.set(w.id, id);
    w.id = id;
  }
  for (const r of results) r.widget_id = map.get(r.widget_id) ?? r.widget_id;
}

// ── Views ───────────────────────────────────────────────────────────────────

async function sourceStatus(organizationId: string, datasetIds: string[]) {
  const rows = await prisma.rexDataset.findMany({
    where: { organizationId, id: { in: datasetIds } },
    select: { id: true, name: true, sourceKind: true, sourceUrl: true, lastSyncedAt: true, syncError: true, updatedAt: true },
  });
  return rows;
}

async function editorView(d: DashboardRow, key = "all") {
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    prompt: d.prompt,
    datasetIds: d.datasetIds,
    datasetAliases: d.datasetAliases,
    filters: d.filters,
    widgets: widgetDefs(d),
    results: await readResults(d.id, d.dataVersion, key),
    isPublic: d.isPublic,
    shareToken: d.shareToken,
    refreshStatus: d.refreshStatus,
    refreshError: d.refreshError,
    lastRefreshedAt: d.lastRefreshedAt,
    sources: await sourceStatus(d.organizationId, d.datasetIds),
    updatedAt: d.updatedAt,
  };
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export const listDashboards = (organizationId: string) =>
  prisma.rexDashboard.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, title: true, description: true, datasetIds: true, isPublic: true, shareToken: true,
      lastRefreshedAt: true, refreshStatus: true, updatedAt: true, _count: { select: { widgets: true } },
    },
  });

export async function createDashboard(
  userId: string,
  organizationId: string,
  input: { prompt: string; datasetIds: string[] },
) {
  const ids = [...new Set(input.datasetIds)].slice(0, MAX_DATASETS);
  const datasets = await loadDatasets(organizationId, ids);
  if (datasets.length === 0) throw new BadRequestError("Pick at least one dataset.");
  const aliases = makeAliases(datasets);
  const { sources } = await sourcesFor(organizationId, datasets.map((d) => d.id), aliases);

  const { data } = await aiService.post<AiDashboardResponse>("/ai/rex/dashboards/generate", {
    user_id: userId, organization_id: organizationId, prompt: input.prompt, sources,
  }, { timeout: AI_TIMEOUT_MS });

  const id = `dsh${randomBytes(10).toString("hex")}`;
  const widgets = data.dashboard.widgets;
  namespaceIds(id, widgets, data.results);
  const filters = data.dashboard.filters;
  const dataVersion = computeVersion(datasets, widgets, filters);

  await prisma.$transaction(async (tx) => {
    await tx.rexDashboard.create({
      data: {
        id, organizationId, userId,
        title: data.dashboard.title, description: data.dashboard.description || null, prompt: input.prompt,
        datasetIds: datasets.map((d) => d.id), datasetAliases: aliases,
        filters: filters as unknown as Prisma.InputJsonValue,
        dataVersion, lastRefreshedAt: new Date(),
      },
    });
    await writeWidgets(tx, id, organizationId, widgets);
  });
  await storeResults(id, dataVersion, data.results);
  // The unfiltered view is ready now; the per-filter results fill in behind it.
  if (filters.length) void refreshDashboard(organizationId, id).catch((err) => console.error("[rex-dash] refresh", err));

  return { ...(await editorView(await findOwned(organizationId, id))), dropped: data.dropped };
}

export async function getDashboard(organizationId: string, id: string, state: FilterState = {}) {
  const d = await findOwned(organizationId, id);
  void syncStaleSources(organizationId, d.datasetIds);
  const key = filterKey(validateState(d.filters as unknown as FilterDef[], state));
  if (key !== "all") await ensureStateComputed(d, key, state);
  return editorView(await findOwned(organizationId, id), key);
}

export async function editByPrompt(
  userId: string,
  organizationId: string,
  id: string,
  input: { prompt: string; widgetId?: string },
) {
  const d = await findOwned(organizationId, id);
  const aliases = d.datasetAliases as Record<string, string>;
  const { sources, datasets } = await sourcesFor(organizationId, d.datasetIds, aliases);
  const { data } = await aiService.post<AiDashboardResponse>("/ai/rex/dashboards/edit", {
    user_id: userId, organization_id: organizationId, prompt: input.prompt, sources,
    widget_id: input.widgetId,
    dashboard: {
      title: d.title, description: d.description ?? "",
      filters: d.filters, widgets: widgetDefs(d),
    },
  }, { timeout: AI_TIMEOUT_MS });

  const widgets = data.dashboard.widgets;
  namespaceIds(d.id, widgets, data.results);
  const filters = data.dashboard.filters;
  const dataVersion = computeVersion(datasets, widgets, filters);
  await prisma.$transaction(async (tx) => {
    await tx.rexDashboard.update({
      where: { id: d.id },
      data: {
        title: data.dashboard.title || d.title,
        description: data.dashboard.description || d.description,
        filters: filters as unknown as Prisma.InputJsonValue, dataVersion, lastRefreshedAt: new Date(),
      },
    });
    await writeWidgets(tx, d.id, organizationId, widgets);
    await tx.rexDashboardResult.deleteMany({ where: { dashboardId: d.id, dataVersion: { not: dataVersion } } });
  });
  await storeResults(d.id, dataVersion, data.results);
  if (filters.length) void refreshDashboard(organizationId, d.id).catch((err) => console.error("[rex-dash] refresh", err));
  return { ...(await editorView(await findOwned(organizationId, d.id))), dropped: data.dropped };
}

export async function updateDashboard(organizationId: string, id: string, patch: { title?: string; description?: string | null }) {
  await findOwned(organizationId, id);
  await prisma.rexDashboard.update({ where: { id }, data: patch });
  return editorView(await findOwned(organizationId, id));
}

export async function deleteDashboard(organizationId: string, id: string) {
  await findOwned(organizationId, id);
  await prisma.$transaction([
    prisma.rexDashboardResult.deleteMany({ where: { dashboardId: id } }),
    prisma.rexDashboard.delete({ where: { id } }),
  ]);
}

export async function updateLayout(organizationId: string, id: string, items: Array<{ id: string; x: number; y: number; w: number; h: number }>) {
  const d = await findOwned(organizationId, id);
  const known = new Set(d.widgets.map((w) => w.id));
  await prisma.$transaction(
    items.filter((i) => known.has(i.id)).map((i) =>
      prisma.rexDashboardWidget.update({ where: { id: i.id }, data: { layout: { x: i.x, y: i.y, w: i.w, h: i.h } } })),
  );
}

/** Manual settings from the side panel. Display changes are instant; a changed query is run
 *  first and refused if it fails, so a dashboard never holds a query that doesn't work. */
export async function updateWidget(
  organizationId: string,
  id: string,
  widgetId: string,
  patch: { title?: string; spec?: Record<string, unknown>; sql?: string; filterIds?: string[] },
) {
  const d = await findOwned(organizationId, id);
  const w = d.widgets.find((x) => x.id === widgetId);
  if (!w) throw new NotFoundError("Widget not found");
  const filters = d.filters as unknown as FilterDef[];
  const filterIds = patch.filterIds?.filter((f) => filters.some((x) => x.id === f));
  const queryChanged = (patch.sql !== undefined && patch.sql !== w.sql) ||
    (filterIds !== undefined && [...filterIds].sort().join() !== [...w.filterIds].sort().join());

  if (patch.sql !== undefined && patch.sql !== w.sql) {
    const { sources } = await sourcesFor(organizationId, d.datasetIds, d.datasetAliases as Record<string, string>);
    const { data } = await aiService.post<AiRunResponse>("/ai/rex/dashboards/check-sql", {
      sources, filters: [], widgets: [{ ...widgetDefs(d).find((x) => x.id === widgetId), sql: patch.sql, filterIds: [] }],
    }, { timeout: AI_TIMEOUT_MS });
    const err = data.results[0]?.error;
    if (err) throw new BadRequestError(`That query doesn't run: ${err}`);
  }

  await prisma.rexDashboardWidget.update({
    where: { id: widgetId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.spec !== undefined ? { spec: { ...(w.spec as object), ...patch.spec } as Prisma.InputJsonValue } : {}),
      ...(patch.sql !== undefined ? { sql: patch.sql } : {}),
      ...(filterIds !== undefined ? { filterIds } : {}),
    },
  });
  if (queryChanged) await refreshDashboard(organizationId, id, { force: true });
  return editorView(await findOwned(organizationId, id));
}

export async function deleteWidget(organizationId: string, id: string, widgetId: string) {
  const d = await findOwned(organizationId, id);
  if (!d.widgets.some((w) => w.id === widgetId)) throw new NotFoundError("Widget not found");
  await prisma.rexDashboardWidget.delete({ where: { id: widgetId } });
  await prisma.rexDashboardResult.deleteMany({ where: { widgetId } });
  return editorView(await findOwned(organizationId, id));
}

export async function duplicateWidget(organizationId: string, id: string, widgetId: string) {
  const d = await findOwned(organizationId, id);
  const w = d.widgets.find((x) => x.id === widgetId);
  if (!w) throw new NotFoundError("Widget not found");
  const layout = w.layout as { x: number; y: number; w: number; h: number };
  const bottom = Math.max(0, ...d.widgets.map((x) => { const l = x.layout as typeof layout; return l.y + l.h; }));
  const copyId = `${d.id.slice(-8)}_w${randomBytes(4).toString("hex")}`;
  await prisma.rexDashboardWidget.create({
    data: {
      id: copyId, dashboardId: d.id, organizationId, kind: w.kind, title: `${w.title} (copy)`, sql: w.sql,
      spec: w.spec as Prisma.InputJsonValue, layout: { ...layout, x: 0, y: bottom }, filterIds: w.filterIds,
    },
  });
  // Same query, same rows: copy them rather than running anything.
  const rows = await prisma.rexDashboardResult.findMany({ where: { widgetId: w.id, dashboardId: d.id } });
  if (rows.length) {
    await prisma.rexDashboardResult.createMany({
      data: rows.map(({ id: _id, computedAt: _c, ...r }) => ({
        ...r, widgetId: copyId, columns: r.columns as Prisma.InputJsonValue, rows: r.rows as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
  }
  // The version hash includes widget ids; recompute it so the copy's rows stay current.
  await refreshDashboard(organizationId, d.id, { force: true });
  return editorView(await findOwned(organizationId, d.id));
}

// ── Refresh ─────────────────────────────────────────────────────────────────

/** Recompute every widget for the unfiltered view and each single filter value, then drop rows
 *  from older versions. Skips the work when nothing changed, unless forced. One at a time per
 *  dashboard. */
export async function refreshDashboard(organizationId: string, id: string, opts: { force?: boolean } = {}) {
  const d = await findOwned(organizationId, id);
  const lockFree = await prisma.rexDashboard.updateMany({
    where: {
      id, OR: [
        { refreshStatus: { not: "running" } },
        { refreshStartedAt: { lt: new Date(Date.now() - REFRESH_LOCK_MS) } },
      ],
    },
    data: { refreshStatus: "running", refreshStartedAt: new Date() },
  });
  if (lockFree.count === 0) return { skipped: "already refreshing" };

  try {
    const aliases = d.datasetAliases as Record<string, string>;
    const { sources, datasets } = await sourcesFor(organizationId, d.datasetIds, aliases);
    const widgets = widgetDefs(d);
    let filters = d.filters as unknown as FilterDef[];
    const version = computeVersion(datasets, widgets, filters);
    if (!opts.force && version === d.dataVersion) {
      const have = await prisma.rexDashboardResult.count({ where: { dashboardId: id, dataVersion: version } });
      if (have >= widgets.length * precomputedStates(filters).length) {
        await prisma.rexDashboard.update({ where: { id }, data: { refreshStatus: "idle", refreshError: null } });
        return { skipped: "up to date" };
      }
    }

    const { data } = await aiService.post<AiRunResponse>("/ai/rex/dashboards/run", {
      sources, filters, widgets, states: precomputedStates(filters),
    }, { timeout: AI_TIMEOUT_MS });

    // Category options follow the data: a new region in the sheet becomes a new choice.
    filters = filters.map((f) => (f.type === "category" && data.filter_options[f.id] ? { ...f, options: data.filter_options[f.id] } : f));
    const optionsChanged = JSON.stringify(filters) !== JSON.stringify(d.filters);
    let results = data.results;
    if (optionsChanged) {
      const extra = precomputedStates(filters).filter((s) => !results.some((r) => r.state_key === s.key));
      if (extra.length) {
        const more = await aiService.post<AiRunResponse>("/ai/rex/dashboards/run",
          { sources, filters, widgets, states: extra }, { timeout: AI_TIMEOUT_MS });
        results = [...results, ...more.data.results];
      }
    }
    // Recompute the version after options change so the stored rows match what's saved.
    const finalVersion = computeVersion(datasets, widgets, filters);
    // Same version means same data and queries, so existing rows are already right; only fill gaps.
    await storeResults(id, finalVersion, results);
    await prisma.$transaction([
      prisma.rexDashboard.update({
        where: { id },
        data: {
          dataVersion: finalVersion, filters: filters as unknown as Prisma.InputJsonValue,
          refreshStatus: "idle", refreshError: null, lastRefreshedAt: new Date(),
        },
      }),
      prisma.rexDashboardResult.deleteMany({ where: { dashboardId: id, dataVersion: { not: finalVersion } } }),
    ]);
    return { refreshed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.rexDashboard.update({ where: { id }, data: { refreshStatus: "error", refreshError: message.slice(0, 500) } });
    throw err;
  }
}

/** A filter combination nobody has asked for yet: compute it once and keep it. */
async function ensureStateComputed(d: DashboardRow, key: string, state: FilterState) {
  if (!d.dataVersion) return;
  const have = await prisma.rexDashboardResult.count({ where: { dashboardId: d.id, dataVersion: d.dataVersion, filterKey: key } });
  if (have > 0) return;
  const stored = await prisma.rexDashboardResult.groupBy({
    by: ["filterKey"], where: { dashboardId: d.id, dataVersion: d.dataVersion },
  });
  const filters = d.filters as unknown as FilterDef[];
  if (stored.length >= precomputedStates(filters).length + MAX_STORED_COMBINATIONS) {
    throw new BadRequestError("This filter combination isn't available — try fewer filters at once.");
  }
  const { sources } = await sourcesFor(d.organizationId, d.datasetIds, d.datasetAliases as Record<string, string>);
  const { data } = await aiService.post<AiRunResponse>("/ai/rex/dashboards/run", {
    sources, filters, widgets: widgetDefs(d), states: [{ key, values: state }],
  }, { timeout: AI_TIMEOUT_MS });
  await storeResults(d.id, d.dataVersion, data.results);
}

// ── Sharing ─────────────────────────────────────────────────────────────────

export async function shareDashboard(organizationId: string, id: string, isPublic: boolean) {
  const d = await findOwned(organizationId, id);
  const shareToken = isPublic ? (d.shareToken ?? randomBytes(16).toString("hex")) : null;
  await prisma.rexDashboard.update({ where: { id }, data: { isPublic, shareToken } });
  return { id, isPublic, shareToken };
}

/** In-process limit on how many new filter combinations one public link can trigger. */
const publicComputeLog = new Map<string, number[]>();
const PUBLIC_NEW_STATES_PER_MIN = 20;

function allowPublicCompute(token: string): boolean {
  const now = Date.now();
  const recent = (publicComputeLog.get(token) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PUBLIC_NEW_STATES_PER_MIN) return false;
  recent.push(now);
  publicComputeLog.set(token, recent);
  return true;
}

/** What a public viewer gets: layout, display settings, and computed rows. Never the SQL, the
 *  dataset names, or anything that points at the source files. */
export async function getPublicDashboard(token: string, state: FilterState = {}) {
  const d = await prisma.rexDashboard.findUnique({ where: { shareToken: token }, include: { widgets: true } });
  if (!d || !d.isPublic) return null;
  const filters = d.filters as unknown as FilterDef[];
  const valid = validateState(filters, state);
  const key = filterKey(valid);
  if (key !== "all" && d.dataVersion) {
    const have = await prisma.rexDashboardResult.count({ where: { dashboardId: d.id, dataVersion: d.dataVersion, filterKey: key } });
    if (have === 0) {
      if (!allowPublicCompute(token)) throw new BadRequestError("Too many new filter combinations — try again in a minute.");
      await ensureStateComputed(d, key, valid);
    }
  }
  return {
    title: d.title,
    description: d.description,
    filters: filters.map((f) => ({ id: f.id, label: f.label, type: f.type, options: f.options ?? null })),
    widgets: d.widgets.map((w) => ({
      id: w.id, kind: w.kind, title: w.title, spec: w.spec, layout: w.layout, filterIds: w.filterIds,
    })),
    results: await readResults(d.id, d.dataVersion, key),
    lastRefreshedAt: d.lastRefreshedAt,
  };
}

// ── Linked spreadsheets ─────────────────────────────────────────────────────

/** Fetch a pasted link and parse it like an upload; the customer then reviews and saves it. */
export async function parseLink(organizationId: string, rawUrl: string) {
  const link = resolveShareLink(rawUrl);
  const sheet = await fetchLinkedSheet(link);
  const { key } = await uploadBuffer({
    organizationId, name: "rex-dataset", buffer: sheet.buffer, extension: sheet.format,
    contentType: sheet.format === "csv" ? "text/csv" : "application/octet-stream",
  });
  const result = await parseDataset(organizationId, key, { data: sheet.buffer, ext: sheet.format });
  return {
    ...result,
    source: { sourceUrl: rawUrl.trim(), downloadUrl: link.downloadUrl, contentHash: sheet.contentHash, provider: link.provider },
  };
}

/** Re-fetch one linked sheet. Unchanged bytes cost nothing further; changed bytes re-parse the
 *  preview, swap the stored file, and refresh every dashboard that uses it. */
export async function syncLinkedSource(organizationId: string, sourceUrl: string) {
  const rows = await prisma.rexDataset.findMany({ where: { organizationId, sourceKind: "link", sourceUrl } });
  if (!rows.length) throw new NotFoundError("Linked dataset not found");
  const first = rows[0]!;
  const ids = rows.map((r) => r.id);
  let sheet;
  try {
    sheet = await fetchLinkedSheet(resolveShareLink(sourceUrl));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.rexDataset.updateMany({ where: { id: { in: ids } }, data: { syncError: message.slice(0, 500) } });
    return { changed: false, error: message };
  }
  if (sheet.contentHash === first.contentHash) {
    await prisma.rexDataset.updateMany({ where: { id: { in: ids } }, data: { lastSyncedAt: new Date(), syncError: null } });
    return { changed: false };
  }

  const parsed = parseBuffer(sheet.buffer, sheet.format);
  if (parsed.rawTable.headers.length === 0) {
    const message = parsed.warnings[0] ?? "The sheet no longer has a readable table.";
    await prisma.rexDataset.updateMany({ where: { id: { in: ids } }, data: { syncError: message } });
    return { changed: false, error: message };
  }
  const { key } = await uploadBuffer({
    organizationId, name: "rex-dataset", buffer: sheet.buffer, extension: sheet.format,
    contentType: sheet.format === "csv" ? "text/csv" : "application/octet-stream",
  });
  const oldKeys = new Set(rows.map((r) => ((r.meta as { rawTable?: RawTable } | null)?.rawTable?.fileKey)).filter(Boolean) as string[]);
  const rawTable = { ...parsed.rawTable, fileKey: key };
  for (const r of rows) {
    const points = parsed.datasets.find((p) => p.metricKey === r.metricKey)?.points;
    await prisma.rexDataset.update({
      where: { id: r.id },
      data: {
        meta: { ...((r.meta as object | null) ?? {}), rawTable } as unknown as Prisma.InputJsonValue,
        ...(points ? { points: points as unknown as Prisma.InputJsonValue } : {}),
        contentHash: sheet.contentHash, lastSyncedAt: new Date(), syncError: null,
      },
    });
  }
  for (const k of oldKeys) void deleteObject(k).catch(() => undefined);

  const dashboards = await prisma.rexDashboard.findMany({
    where: { organizationId, datasetIds: { hasSome: ids } }, select: { id: true },
  });
  for (const dash of dashboards) {
    await refreshDashboard(organizationId, dash.id).catch((err) => console.error("[rex-dash] refresh after sync", err));
  }
  return { changed: true, dashboards: dashboards.length };
}

const inFlightSyncs = new Set<string>();

/** Opening a dashboard catches up linked sheets that haven't been checked for a while. */
async function syncStaleSources(organizationId: string, datasetIds: string[]) {
  const stale = await prisma.rexDataset.findMany({
    where: {
      organizationId, id: { in: datasetIds }, sourceKind: "link", syncEnabled: true,
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: new Date(Date.now() - STALE_SYNC_MS) } }],
    },
    select: { sourceUrl: true },
    distinct: ["sourceUrl"],
  });
  for (const s of stale) {
    if (!s.sourceUrl) continue;
    const k = `${organizationId}|${s.sourceUrl}`;
    if (inFlightSyncs.has(k)) continue;
    inFlightSyncs.add(k);
    void syncLinkedSource(organizationId, s.sourceUrl)
      .catch((err) => console.error("[rex-sync]", err))
      .finally(() => inFlightSyncs.delete(k));
  }
}

/** The 15-minute schedule: only linked sheets some dashboard actually uses. */
export async function syncAllLinkedSources() {
  const dashboards = await prisma.rexDashboard.findMany({ select: { datasetIds: true } });
  const used = [...new Set(dashboards.flatMap((d) => d.datasetIds))];
  if (!used.length) return;
  const due = await prisma.rexDataset.findMany({
    where: {
      id: { in: used }, sourceKind: "link", syncEnabled: true,
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: new Date(Date.now() - STALE_SYNC_MS + 60_000) } }],
    },
    select: { organizationId: true, sourceUrl: true },
    distinct: ["organizationId", "sourceUrl"],
  });
  const queue = due.filter((d) => d.sourceUrl);
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const k = `${job.organizationId}|${job.sourceUrl}`;
      if (inFlightSyncs.has(k)) continue;
      inFlightSyncs.add(k);
      await syncLinkedSource(job.organizationId, job.sourceUrl!)
        .catch((err) => console.error("[rex-sync]", err))
        .finally(() => inFlightSyncs.delete(k));
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}
