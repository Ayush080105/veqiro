import {
  Agent,
  McpActionSource,
  McpTriggerEventStatus,
} from "../../../prisma/generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { composioClient } from "../../lib/composio.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { NotFoundError } from "../../common/errors/notFound.js";
import { callAgentWithContext, agentRoles } from "../../common/utils/contextService.js";
import {
  TRIGGER_DEFINITIONS,
  findTriggerDefinition,
  type TriggerDefinition,
} from "./mcp.triggers.js";
import * as mcpService from "./mcp.service.js";

/**
 * Inbound triggers — the only path in this module that starts without a human.
 *
 * Everything else here runs because someone asked; a trigger runs because
 * something happened in a system the org connected. That inversion is why this
 * file is careful in ways the request-driven paths are not: it verifies the
 * sender, refuses to run twice on one event, caps how often a subscription may
 * fire, and never executes a write — it only proposes one.
 */

/** Public base URL Composio posts events to. ngrok in dev, the real host in prod. */
const webhookBaseUrl = (): string => {
  const url = process.env.COMPOSIO_WEBHOOK_URL ?? process.env.PUBLIC_API_URL;
  if (!url) {
    throw new BadRequestError(
      "No public webhook URL configured. Set COMPOSIO_WEBHOOK_URL to a publicly " +
        "reachable HTTPS address before enabling triggers.",
    );
  }
  return url.replace(/\/+$/, "");
};

/**
 * A subscription firing more often than a human could review is a bug, not a
 * feature — a busy Slack channel or a marketing blast would otherwise queue
 * hundreds of drafts. Events past the cap are recorded and skipped, so the
 * ceiling shows up in the event log instead of being silently swallowed.
 */
const MAX_EVENTS_PER_SUBSCRIPTION_PER_HOUR = 20;
/**
 * A second ceiling across every subscription in an org. The per-subscription
 * cap alone bounds one noisy channel; it does not bound seven of them at once,
 * and each event is a full agent run with its own provider calls. This is the
 * number that stops a runaway configuration from quietly costing a fortune.
 */
const MAX_EVENTS_PER_ORG_PER_HOUR = 60;

export interface TriggerSummary {
  id: string;
  integrationSlug: string;
  label: string;
  description: string;
  agent: Agent;
  /** False when the integration this needs isn't connected. */
  available: boolean;
  subscribed: boolean;
  enabled: boolean;
  lastEventAt: string | null;
  lastError: string | null;
}

/**
 * The trigger catalog, each entry annotated with whether this org can use it
 * and whether it currently does. Entries whose integration isn't connected come
 * back as `available: false` rather than hidden — "connect Gmail to switch this
 * on" is a more useful empty state than an absence.
 */
export const listTriggers = async (organizationId: string): Promise<TriggerSummary[]> => {
  const [connections, subscriptions] = await Promise.all([
    prisma.mcpConnection.findMany({
      where: { organizationId, status: "CONNECTED" },
      select: { integrationSlug: true },
    }),
    prisma.mcpTriggerSubscription.findMany({ where: { organizationId } }),
  ]);
  const connected = new Set(connections.map((c) => c.integrationSlug));
  const bySlug = new Map(subscriptions.map((s) => [s.triggerSlug, s]));

  return TRIGGER_DEFINITIONS.map((def) => {
    const sub = bySlug.get(def.triggerSlug);
    return {
      id: def.id,
      integrationSlug: def.integrationSlug,
      label: def.label,
      description: def.description,
      agent: def.agent,
      available: connected.has(def.integrationSlug),
      subscribed: Boolean(sub),
      enabled: sub?.enabled ?? false,
      lastEventAt: sub?.lastEventAt?.toISOString() ?? null,
      lastError: sub?.lastError ?? null,
    };
  });
};

/**
 * Registers this deployment's webhook URL with Composio. Idempotent, and cheap
 * enough to call before every subscribe — the URL changes every time an ngrok
 * tunnel restarts, and a stale one fails silently as "the trigger just never
 * fires", which is the most expensive way for this to break.
 */
export const ensureWebhookSubscription = async (): Promise<string> => {
  const webhookUrl = `${webhookBaseUrl()}/api/v1/mcp/webhooks/composio`;
  await composioClient.triggers.setWebhookSubscription({ webhookUrl });
  return webhookUrl;
};

export const subscribeTrigger = async (
  organizationId: string,
  userId: string,
  triggerId: string,
  config?: Record<string, unknown>,
): Promise<TriggerSummary> => {
  const def = findTriggerDefinition(triggerId);
  if (!def) throw new NotFoundError("Unknown trigger");

  const connection = await prisma.mcpConnection.findFirst({
    where: { organizationId, integrationSlug: def.integrationSlug, status: "CONNECTED" },
  });
  if (!connection) {
    throw new BadRequestError(`Connect ${def.integrationSlug} before turning this on.`);
  }

  await ensureWebhookSubscription();

  // Local row first, so a Composio failure leaves a visibly half-created row
  // (null composioTriggerId) rather than an orphaned remote subscription
  // posting events at a deployment with no record of them.
  const row = await prisma.mcpTriggerSubscription.upsert({
    where: { organizationId_triggerSlug: { organizationId, triggerSlug: def.triggerSlug } },
    create: {
      organizationId,
      integrationSlug: def.integrationSlug,
      connectionId: connection.connectionId,
      triggerSlug: def.triggerSlug,
      agent: def.agent,
      createdByUserId: userId,
      enabled: true,
    },
    update: { enabled: true, lastError: null, connectionId: connection.connectionId },
  });

  if (!row.composioTriggerId) {
    try {
      // Composio's `userId` is our organizationId — see lib/composio.ts.
      const created = await composioClient.triggers.create(organizationId, def.triggerSlug, {
        connectedAccountId: connection.connectionId,
        triggerConfig: { ...(def.config ?? {}), ...(config ?? {}) },
      } as never);
      const composioTriggerId =
        (created as { triggerId?: string; id?: string }).triggerId ??
        (created as { id?: string }).id ??
        null;
      await prisma.mcpTriggerSubscription.update({
        where: { id: row.id },
        data: { composioTriggerId, lastError: null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.mcpTriggerSubscription.update({
        where: { id: row.id },
        data: { lastError: message, enabled: false },
      });
      throw new BadRequestError(`Couldn't turn this on: ${message}`);
    }
  }

  const summaries = await listTriggers(organizationId);
  return summaries.find((s) => s.id === triggerId)!;
};

export const setTriggerEnabled = async (
  organizationId: string,
  triggerId: string,
  enabled: boolean,
): Promise<TriggerSummary> => {
  const def = findTriggerDefinition(triggerId);
  if (!def) throw new NotFoundError("Unknown trigger");
  const row = await prisma.mcpTriggerSubscription.findUnique({
    where: { organizationId_triggerSlug: { organizationId, triggerSlug: def.triggerSlug } },
  });
  if (!row) throw new NotFoundError("Trigger isn't set up for this organization");

  // Disabling drops events at the door rather than deleting the remote
  // subscription: re-enabling is then instant, and Composio's trigger instance
  // doesn't churn every time someone flips a switch.
  await prisma.mcpTriggerSubscription.update({
    where: { id: row.id },
    data: { enabled, lastError: null },
  });
  const summaries = await listTriggers(organizationId);
  return summaries.find((s) => s.id === triggerId)!;
};

export const unsubscribeTrigger = async (
  organizationId: string,
  triggerId: string,
): Promise<void> => {
  const def = findTriggerDefinition(triggerId);
  if (!def) throw new NotFoundError("Unknown trigger");
  const row = await prisma.mcpTriggerSubscription.findUnique({
    where: { organizationId_triggerSlug: { organizationId, triggerSlug: def.triggerSlug } },
  });
  if (!row) return;

  if (row.composioTriggerId) {
    try {
      await composioClient.triggers.delete(row.composioTriggerId);
    } catch (err) {
      // The local row goes regardless: an unrecognised remote subscription is
      // already handled at the door, and keeping the row would strand the
      // customer with a switch that won't turn off.
      console.error("[triggers] remote delete failed", {
        triggerId: row.composioTriggerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  await prisma.mcpTriggerSubscription.delete({ where: { id: row.id } });
};

/** A verified Composio delivery, narrowed to the fields this module uses. */
export interface InboundEvent {
  eventId: string;
  triggerSlug: string;
  composioTriggerId: string | null;
  connectedAccountId: string | null;
  data: Record<string, unknown>;
}

/**
 * Records the event and decides whether to act on it. Returns quickly — Composio
 * retries anything it doesn't get a prompt acknowledgement for, and a retry
 * arriving while the first agent run is still in flight is exactly the
 * duplicate the ledger exists to prevent.
 */
export const acceptInboundEvent = async (
  event: InboundEvent,
): Promise<{ accepted: boolean; reason?: string }> => {
  const subscription = event.composioTriggerId
    ? await prisma.mcpTriggerSubscription.findUnique({
        where: { composioTriggerId: event.composioTriggerId },
      })
    : await prisma.mcpTriggerSubscription.findFirst({
        where: {
          triggerSlug: event.triggerSlug,
          connectionId: event.connectedAccountId ?? "",
        },
      });

  if (!subscription) return { accepted: false, reason: "no matching subscription" };
  if (!subscription.enabled) return { accepted: false, reason: "subscription disabled" };

  // Dedupe on the provider's own event id. A duplicate delivery loses the race
  // here instead of running the agent a second time.
  let eventRow;
  try {
    eventRow = await prisma.mcpTriggerEvent.create({
      data: {
        providerEventId: event.eventId,
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        triggerSlug: event.triggerSlug,
      },
    });
  } catch {
    return { accepted: false, reason: "duplicate event" };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recentCount, orgCount] = await Promise.all([
    prisma.mcpTriggerEvent.count({
      where: { subscriptionId: subscription.id, createdAt: { gte: oneHourAgo } },
    }),
    prisma.mcpTriggerEvent.count({
      where: { organizationId: subscription.organizationId, createdAt: { gte: oneHourAgo } },
    }),
  ]);
  if (recentCount > MAX_EVENTS_PER_SUBSCRIPTION_PER_HOUR) {
    await finishEvent(
      eventRow.id,
      McpTriggerEventStatus.SKIPPED,
      `Rate cap reached (${MAX_EVENTS_PER_SUBSCRIPTION_PER_HOUR}/hour for this trigger)`,
    );
    return { accepted: false, reason: "rate cap" };
  }
  if (orgCount > MAX_EVENTS_PER_ORG_PER_HOUR) {
    await finishEvent(
      eventRow.id,
      McpTriggerEventStatus.SKIPPED,
      `Rate cap reached (${MAX_EVENTS_PER_ORG_PER_HOUR}/hour across all triggers)`,
    );
    return { accepted: false, reason: "org rate cap" };
  }

  await prisma.mcpTriggerSubscription.update({
    where: { id: subscription.id },
    data: { lastEventAt: new Date() },
  });

  // Deliberately not awaited: the caller has already decided to return 200.
  void processEvent(eventRow.id, subscription, event).catch((err) => {
    console.error("[triggers] processing failed", {
      eventId: eventRow.id,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return { accepted: true };
};

/**
 * Runs the agent for one event and stages whatever it proposes. Never executes
 * a write itself — a trigger firing is not consent, so an unattended run ends
 * in a proposal the owner still has to approve.
 */
const processEvent = async (
  eventRowId: string,
  subscription: {
    id: string;
    organizationId: string;
    createdByUserId: string;
    agent: Agent;
    triggerSlug: string;
  },
  event: InboundEvent,
): Promise<void> => {
  const def = TRIGGER_DEFINITIONS.find((d) => d.triggerSlug === subscription.triggerSlug);
  if (!def) {
    await finishEvent(eventRowId, McpTriggerEventStatus.SKIPPED, "no catalog entry");
    return;
  }

  try {
    const response = await callAgentWithContext<{
      response: string;
      mcp_pending_actions?: unknown[];
    }>({
      agentApiPath: `/ai/${def.agent.toLowerCase()}/chat`,
      agentEnum: def.agent,
      agentRole: agentRoles[def.agent],
      userId: subscription.createdByUserId,
      organizationId: subscription.organizationId,
      conversationId: `trigger-${eventRowId}`,
      userMessage: buildAgentPrompt(def, event.data),
      rawHistory: [],
    });

    // Surfaced in the agent's own conversation, so the owner meets it where
    // they already read that agent rather than in a separate feed.
    const assistantMessage = await prisma.message.create({
      data: {
        organizationId: subscription.organizationId,
        userId: subscription.createdByUserId,
        agent: def.agent,
        role: "assistant",
        content: response.response,
        customInput: { triggeredBy: def.label, triggerEventId: eventRowId },
      },
    });

    const pending = (response.mcp_pending_actions ?? []) as Parameters<
      typeof mcpService.stagePendingActions
    >[0]["pendingActions"];
    if (pending.length > 0) {
      await mcpService.stagePendingActions({
        organizationId: subscription.organizationId,
        userId: subscription.createdByUserId,
        agent: def.agent,
        messageId: assistantMessage.id,
        pendingActions: pending,
        source: McpActionSource.TRIGGER,
        triggerEventId: eventRowId,
      });
    }

    await finishEvent(eventRowId, McpTriggerEventStatus.PROCESSED, null);
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    await finishEvent(eventRowId, McpTriggerEventStatus.FAILED, messageText);
    await prisma.mcpTriggerSubscription.update({
      where: { id: subscription.id },
      data: { lastError: messageText },
    });
  }
};

const finishEvent = async (
  id: string,
  status: McpTriggerEventStatus,
  error: string | null,
): Promise<void> => {
  await prisma.mcpTriggerEvent.update({
    where: { id },
    data: { status, error, processedAt: new Date() },
  });
};

/**
 * Turns a provider payload into the agent's instruction. The payload goes in as
 * JSON rather than being summarised here — the agent reads a Gmail message
 * shape better than any per-trigger mapping this file could hardcode.
 */
const buildAgentPrompt = (def: TriggerDefinition, data: Record<string, unknown>): string => {
  const payload = JSON.stringify(data, null, 2).slice(0, 8000);
  return `${def.prompt}\n\nHere is the event:\n\`\`\`json\n${payload}\n\`\`\``;
};
