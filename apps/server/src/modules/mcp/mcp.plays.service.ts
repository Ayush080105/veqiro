import { Agent, McpActionSource } from "../../../prisma/generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { NotFoundError } from "../../common/errors/notFound.js";
import { callAgentWithContext, agentRoles } from "../../common/utils/contextService.js";
import { PLAY_DEFINITIONS, findPlayDefinition, type PlayDefinition } from "./mcp.plays.js";
import * as mcpService from "./mcp.service.js";
import { generateContentPlan } from "../agents/maya/maya.contentplan.js";

/**
 * Plays — scheduled, repeatable work. The scheduled sibling of triggers: same
 * unattended-run discipline, different reason for waking up.
 */

export interface PlaySummary {
  id: string;
  name: string;
  description: string;
  agent: Agent;
  scheduleLabel: string;
  /** Catalog slugs this needs. */
  requires: string[];
  /** Slugs from `requires` that aren't connected yet. */
  missing: string[];
  available: boolean;
  enabled: boolean;
  lastRunAt: string | null;
  lastError: string | null;
}

export const listPlays = async (organizationId: string): Promise<PlaySummary[]> => {
  const [connections, rows] = await Promise.all([
    prisma.mcpConnection.findMany({
      where: { organizationId, status: "CONNECTED" },
      select: { integrationSlug: true },
    }),
    prisma.mcpPlay.findMany({ where: { organizationId } }),
  ]);
  const connected = new Set(connections.map((c) => c.integrationSlug));
  const byPlayId = new Map(rows.map((r) => [r.playId, r]));

  return PLAY_DEFINITIONS.map((def) => {
    const row = byPlayId.get(def.id);
    const missing = def.requires.filter((slug) => !connected.has(slug));
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      agent: def.agent,
      scheduleLabel: def.scheduleLabel,
      requires: def.requires,
      missing,
      available: missing.length === 0,
      enabled: row?.enabled ?? false,
      lastRunAt: row?.lastRunAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
    };
  });
};

export const setPlayEnabled = async (
  organizationId: string,
  userId: string,
  playId: string,
  enabled: boolean,
): Promise<PlaySummary> => {
  const def = findPlayDefinition(playId);
  if (!def) throw new NotFoundError("Unknown play");

  if (enabled) {
    const connections = await prisma.mcpConnection.findMany({
      where: { organizationId, status: "CONNECTED" },
      select: { integrationSlug: true },
    });
    const connected = new Set(connections.map((c) => c.integrationSlug));
    const missing = def.requires.filter((slug) => !connected.has(slug));
    if (missing.length > 0) {
      throw new BadRequestError(`Connect ${missing.join(" and ")} to use this play.`);
    }
  }

  await prisma.mcpPlay.upsert({
    where: { organizationId_playId: { organizationId, playId } },
    // Schedule is captured here, at enable time, so revising a play's default
    // later doesn't silently move an existing customer's Monday.
    create: {
      organizationId,
      playId,
      schedule: def.schedule,
      enabled,
      createdByUserId: userId,
    },
    update: { enabled, lastError: null },
  });

  const summaries = await listPlays(organizationId);
  return summaries.find((p) => p.id === playId)!;
};

/**
 * Runs one play now. Shared by the scheduler and by "run it now" in the UI —
 * a play nobody can trigger on demand is one nobody trusts enough to schedule.
 */
export const runPlay = async (params: {
  organizationId: string;
  userId: string;
  def: PlayDefinition;
}): Promise<{ messageId: string }> => {
  const { organizationId, userId, def } = params;

  // The content plan has a real artifact and its own tab, so the scheduled run
  // goes through the same code the Generate button does. Without this the
  // schedule would quietly produce a chat message while the button produced a
  // stored plan — two different things wearing one name.
  if (def.id === "content-plan") {
    const plan = await generateContentPlan(organizationId, userId);
    return { messageId: plan.id };
  }

  const response = await callAgentWithContext<{
    response: string;
    mcp_pending_actions?: unknown[];
  }>({
    agentApiPath: `/ai/${def.agent.toLowerCase()}/chat`,
    agentEnum: def.agent,
    agentRole: agentRoles[def.agent],
    userId,
    organizationId,
    conversationId: `play-${def.id}-${Date.now()}`,
    userMessage: def.prompt,
    rawHistory: [],
    // Not a conversation — see AgentCallOptions.skipMemory.
    skipMemory: true,
  });

  const message = await prisma.message.create({
    data: {
      organizationId,
      userId,
      agent: def.agent,
      role: "assistant",
      content: response.response,
      customInput: { playId: def.id, playName: def.name },
    },
  });

  const pending = (response.mcp_pending_actions ?? []) as Parameters<
    typeof mcpService.stagePendingActions
  >[0]["pendingActions"];
  if (pending.length > 0) {
    // TRIGGER, not CHAT: nobody was watching when this ran, which is what the
    // confirm UI needs to know to present it with its own context.
    await mcpService.stagePendingActions({
      organizationId,
      userId,
      agent: def.agent,
      messageId: message.id,
      pendingActions: pending,
      source: McpActionSource.TRIGGER,
    });
  }

  return { messageId: message.id };
};

export const runPlayNow = async (
  organizationId: string,
  userId: string,
  playId: string,
): Promise<{ messageId: string }> => {
  const def = findPlayDefinition(playId);
  if (!def) throw new NotFoundError("Unknown play");
  const result = await runPlay({ organizationId, userId, def });
  await prisma.mcpPlay.updateMany({
    where: { organizationId, playId },
    data: { lastRunAt: new Date(), lastError: null },
  });
  return result;
};

/**
 * Every enabled play whose cron expression is due, run once. Called by the
 * scheduler each minute.
 *
 * Runs are sequential rather than parallel: a hundred orgs' plays all firing at
 * 9am would otherwise open a hundred concurrent agent calls, and the failure
 * mode there is the AI service falling over rather than a play being late.
 */
export const runDuePlays = async (isDue: (schedule: string) => boolean): Promise<number> => {
  const enabled = await prisma.mcpPlay.findMany({ where: { enabled: true } });
  let ran = 0;

  for (const row of enabled) {
    if (!isDue(row.schedule)) continue;
    const def = findPlayDefinition(row.playId);
    if (!def) continue;

    try {
      await runPlay({
        organizationId: row.organizationId,
        userId: row.createdByUserId,
        def,
      });
      await prisma.mcpPlay.update({
        where: { id: row.id },
        data: { lastRunAt: new Date(), lastError: null },
      });
      ran += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[plays] run failed", { playId: row.playId, org: row.organizationId, error: message });
      // Recorded, not disabled: one bad morning shouldn't silently switch off
      // something the customer is relying on.
      await prisma.mcpPlay.update({
        where: { id: row.id },
        data: { lastRunAt: new Date(), lastError: message },
      });
    }
  }

  return ran;
};
