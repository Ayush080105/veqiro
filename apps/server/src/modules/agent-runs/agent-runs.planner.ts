import { aiService } from "../../common/utils/aiService.js";
import { prisma } from "../../config/prisma.js";
import * as mcpService from "../mcp/mcp.service.js";
import * as runsService from "./agent-runs.service.js";
import { getEntitledAgents } from "../billing/entitlement.service.js";
import type { AgentRunTrigger } from "../../../prisma/generated/prisma/client.js";
import type { PlanNodeInput } from "./agent-runs.types.js";
import { Agent } from "../../../prisma/generated/prisma/client.js";

/**
 * Entry point for planned runs, called by each agent's sendMessage before it
 * falls through to the normal single-pass path.
 *
 * Returns null far more often than not — the caller must treat null as "carry
 * on as before". Every failure mode here (flag off, nothing connected, planner
 * declined, AI service down) resolves to null rather than throwing, because
 * this sits on the critical path of an ordinary chat turn.
 */

/** Wall-clock ceiling for the planning hop. */
const PLAN_TIMEOUT_MS = 20_000;

/**
 * Cheap, deliberately loose pre-filter so the internal hop only happens for
 * plausible candidates.
 *
 * Intentionally a *superset* of apps/ai's `should_plan`: this only avoids a
 * network round trip, so a false positive costs one request while a false
 * negative silently disables the feature for that phrasing. The authoritative
 * decision is Python's.
 */
const SEQUENCING = /\b(then|after that|afterwards|finally|and then|followed by)\b/i;
const ACTIONS = [
  "audit", "cross-check", "crosscheck", "compare", "open", "create", "draft",
  "send", "update", "summarise", "summarize", "export", "prioritise",
  "prioritize", "file", "review", "pull", "fetch", "analyse", "analyze",
  "publish", "schedule", "reconcile",
];

export const shouldConsiderPlanning = (message: string): boolean => {
  const text = message.toLowerCase();
  const words = message.trim().split(/\s+/);
  if (words.length <= 6) return false;

  if (SEQUENCING.test(text)) return true;
  if (/\b(for each|top \d+)\b/i.test(text)) return true;

  const hits = ACTIONS.filter((a) =>
    new RegExp(`\\b${a.replace(/[-]/g, "\\-")}\\b`, "i").test(text),
  ).length;
  if (hits >= 2) return true;

  return words.length > 25 && text.includes(" and ");
};

/** Short text above the graph. The graph carries the detail. */
const buildPreamble = (goal: string, steps: number, writes: number): string => {
  const head = goal ? `Here's how I'd do it: ${goal}` : "Here's how I'd approach this.";
  const shape =
    writes > 0
      ? `${steps} steps, ${writes} of which change something outside Veqiro.`
      : `${steps} steps, all read-only.`;
  return `${head}

${shape} Review the plan below and approve it to run.`;
};

interface PlanApiNode {
  key: string;
  title: string;
  agent: string;
  intent: string;
  integration_slug?: string | null;
  depends_on?: string[];
  is_write?: boolean;
  expected_scope?: string | null;
}

interface PlanApiResponse {
  planned: boolean;
  reason?: string;
  plan?: {
    goal: string;
    nodes: PlanApiNode[];
    unavailable?: unknown[];
    final_deliverables?: string[];
    planner_meta?: Record<string, unknown>;
  };
}

const AGENT_BY_SLUG: Record<string, Agent> = {
  maya: Agent.MAYA,
  sage: Agent.SAGE,
  lex: Agent.LEX,
  rex: Agent.REX,
  scout: Agent.SCOUT,
  vega: Agent.VEGA,
};

export interface MaybeStartPlannedRunInput {
  organizationId: string;
  userId: string;
  agent: Agent;
  content: string;
  /**
   * Team mode: plan across every agent the org is entitled to, using the union
   * of their connected integrations, instead of just `agent`'s.
   *
   * `agent` still matters in team mode — it is the lead recorded on the run,
   * and the agent whose tool cache the planner reads through.
   */
  team?: boolean;
  /**
   * Nobody is watching. The run starts immediately with no approval step,
   * every write is staged as a card instead of performed, and the message it
   * creates carries the caller's own customInput rather than a chat preamble.
   *
   * The single-step pre-filter still applies. Triggers fire on every matching
   * event, and paying for a planner round trip to be told "this is one step"
   * each time is exactly the cost that filter exists to avoid.
   */
  unattended?: boolean;
  /** Extra keys for the created message, so a play keeps its own identity. */
  messageCustomInput?: Record<string, unknown>;
  /** How the run was started; defaults to CHAT. */
  trigger?: AgentRunTrigger;
  /** The trigger event that caused it, when trigger is TRIGGER. */
  triggerEventId?: string;
}

/**
 * Connections and catalog the planner is allowed to see.
 *
 * In team mode this is the union across entitled agents only. An agent the org
 * has not bought contributes nothing — not its integrations, and not itself as
 * an assignee — so the room is exactly what the customer pays for and there is
 * no separate team SKU to price.
 */
const resolveScope = async (
  organizationId: string,
  agent: Agent,
  team: boolean,
): Promise<{
  agents: Agent[];
  connections: Awaited<ReturnType<typeof mcpService.getConnectionsForAgent>>;
  catalog: ReturnType<typeof mcpService.getCatalogForAgent>;
}> => {
  if (!team) {
    const connections = await mcpService.getConnectionsForAgent(organizationId, agent);
    return {
      agents: [agent],
      connections,
      catalog: mcpService.getCatalogForAgent(agent, connections),
    };
  }

  const agents = await getEntitledAgents(organizationId);
  if (agents.length === 0) return { agents: [], connections: [], catalog: [] };

  const perAgent = await Promise.all(
    agents.map((a) => mcpService.getConnectionsForAgent(organizationId, a)),
  );
  // Dedupe: one integration can be shared by several agents.
  const byId = new Map<string, (typeof perAgent)[number][number]>();
  for (const list of perAgent) {
    for (const c of list) byId.set(c.connectionId, c);
  }
  const connections = [...byId.values()];

  const catalogBySlug = new Map<string, ReturnType<typeof mcpService.getCatalogForAgent>[number]>();
  for (const a of agents) {
    for (const e of mcpService.getCatalogForAgent(a, connections)) {
      const prev = catalogBySlug.get(e.slug);
      catalogBySlug.set(e.slug, {
        ...e,
        // Connected anywhere in the team means connected for the team.
        connected: Boolean(prev?.connected || e.connected),
        // Union the owners, and keep only those actually in this room — the
        // planner must not assign a step to an agent the org has not bought.
        agents: [...new Set([...(prev?.agents ?? []), ...e.agents])].filter((slug) =>
          agents.some((owned) => owned.toLowerCase() === slug.toLowerCase()),
        ),
      });
    }
  }
  return { agents, connections, catalog: [...catalogBySlug.values()] };
};

/**
 * Plans a run if the request warrants one. Null means "take the normal path".
 *
 * `lastSkipReason` records *why* the last call declined, so a caller can tell
 * "this was a single-step request" apart from "planning broke". The team room
 * needs that distinction: it explains the first and must not claim it for the
 * second.
 */
export let lastSkipReason: "not-multi-step" | "unavailable" | "error" | null = null;

export const maybeStartPlannedRun = async (
  input: MaybeStartPlannedRunInput,
): Promise<Awaited<ReturnType<typeof prisma.message.create>> | null> => {
  lastSkipReason = null;
  try {
    // The pre-filter exists to avoid a network hop for obviously single-step
    // messages in an agent's own chat. The team room always graphs, so it must
    // not be short-circuited here — "check my unread gmail" is four words and
    // would never reach the planner otherwise.
    if (!input.team && !shouldConsiderPlanning(input.content)) {
      lastSkipReason = "not-multi-step";
      return null;
    }

    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { plannedRunsEnabled: true },
    });
    if (!org?.plannedRunsEnabled) {
      lastSkipReason = "unavailable";
      return null;
    }

    const { agents, connections, catalog } = await resolveScope(
      input.organizationId,
      input.agent,
      Boolean(input.team),
    );
    // A planned run with nothing connected cannot deliver anything the normal
    // path would not; it would only add latency.
    if (connections.length === 0 || agents.length === 0) {
      lastSkipReason = "unavailable";
      return null;
    }

    // aiService has no default timeout (axios default is 0 = wait forever), so
    // an explicit one is required here: this call blocks the user's chat turn.
    const { data } = await aiService.post<PlanApiResponse>(
      "/ai/runs/plan",
      {
        organization_id: input.organizationId,
        agent: input.agent.toLowerCase(),
        message: input.content,
        mcp_connections: connections,
        mcp_catalog: catalog,
        allowed_agents: agents.map((a) => a.toLowerCase()),
        // The team room always shows a graph, even for one step: the graph is
        // how it communicates which agent and which connection will act.
        force: Boolean(input.team),
      },
      { timeout: PLAN_TIMEOUT_MS },
    );

    if (!data?.planned || !data.plan?.nodes?.length) {
      lastSkipReason = "not-multi-step";
      return null;
    }

    const nodes: PlanNodeInput[] = data.plan.nodes.flatMap((n) => {
      const agent = AGENT_BY_SLUG[n.agent?.toLowerCase() ?? ""];
      if (!agent) return [];
      return [{
        key: n.key,
        title: n.title,
        agent,
        intent: n.intent,
        integrationSlug: n.integration_slug ?? null,
        dependsOn: n.depends_on ?? [],
        isWrite: Boolean(n.is_write),
        expectedScope: n.expected_scope ?? null,
      }];
    });
    // Python validated the graph, but it names agents as slugs; anything that
    // failed to map here would leave dangling dependencies.
    const keys = new Set(nodes.map((n) => n.key));
    const minNodes = input.team ? 1 : 2;
    if (nodes.length !== data.plan.nodes.length || nodes.length < minNodes) {
      lastSkipReason = "not-multi-step";
      return null;
    }
    for (const n of nodes) n.dependsOn = n.dependsOn.filter((d) => keys.has(d));

    const run = await runsService.createRun({
      organizationId: input.organizationId,
      userId: input.userId,
      agent: input.agent,
      requestText: input.content,
      isTeam: Boolean(input.team),
      trigger: input.trigger,
      triggerEventId: input.triggerEventId ?? null,
      goal: data.plan.goal ?? "",
      plannerMeta: data.plan.planner_meta ?? {},
      nodes,
    });

    const writeCount = nodes.filter((n) => n.isWrite).length;
    const assistantMessage = await prisma.message.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        agent: input.agent,
        role: "assistant",
        isTeam: Boolean(input.team),
        content: buildPreamble(run.goal, nodes.length, writeCount),
        // The graph is rendered from the run, fetched live by id. The snapshot
        // here is only the handle — never the state.
        customInput: {
          ...(input.messageCustomInput ?? {}),
          runId: run.id,
          planVersion: run.planVersion,
        },
      },
    });

    await runsService.attachMessage(run.id, assistantMessage.id);

    // Unattended, there is nobody to approve a plan, so the run starts on its
    // own. It is dispatched in stage mode: reads execute, and every write
    // becomes a card the user confirms later. approvedWrites stays empty
    // precisely because nothing here was approved.
    if (input.unattended) {
      await runsService.startUnattendedRun(run.id);
    }

    return assistantMessage;
  } catch (err) {
    // Never fail a chat turn because planning failed.
    lastSkipReason = "error";
    console.warn(
      "[agent-runs] planning skipped:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
};
