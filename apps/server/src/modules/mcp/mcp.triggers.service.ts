import {
  Agent,
  McpActionSource,
  McpProvider,
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
  findTriggerDefinitionBySlug,
  genericTriggerPrompt,
  humanizeTriggerName,
  type TriggerDefinition,
} from "./mcp.triggers.js";
import { getIntegrationBySlug } from "@repo/integrations-catalog";
import * as repo from "./mcp.repository.js";
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

/**
 * Where Composio posts trigger events.
 *
 * The production host is a constant rather than a required env var, because a
 * missing var here fails in the worst possible way: subscribing appears to
 * succeed and events simply never arrive, with nothing on screen saying why.
 * A default means production cannot be misconfigured by omission.
 *
 * COMPOSIO_WEBHOOK_URL still overrides it, which is what makes local testing
 * possible at all — an ngrok URL changes every restart.
 *
 * One hazard that override brings, worth knowing before using it:
 * setWebhookSubscription is account-level on Composio, one URL per API key.
 * Pointing it at a laptop repoints EVERY environment sharing that key, so
 * production stops receiving events until someone notices. Use a separate
 * Composio API key for local work rather than borrowing production's.
 */
const PRODUCTION_WEBHOOK_BASE_URL = "https://api.veqiro.com";

const webhookBaseUrl = (): string => {
  const url =
    process.env.COMPOSIO_WEBHOOK_URL ??
    process.env.PUBLIC_API_URL ??
    PRODUCTION_WEBHOOK_BASE_URL;
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
  /** Stable id: the curated id where one exists, otherwise the provider slug. */
  id: string;
  integrationSlug: string;
  /** Integration name as the customer knows it. */
  integrationName: string;
  /** Provider's own trigger slug. */
  triggerSlug: string;
  label: string;
  description: string;
  agent: Agent;
  /** True when this has a hand-written instruction rather than the generic one. */
  curated: boolean;
  subscribed: boolean;
  enabled: boolean;
  /** The org's override, if they wrote one. */
  instruction: string | null;
  lastEventAt: string | null;
  lastError: string | null;
}

/** How long a toolkit's trigger list is trusted. Catalogs change when the
 *  provider ships new triggers — rarely, and never urgently. */
const TRIGGER_CATALOG_TTL_MS = 24 * 60 * 60 * 1000;

interface RawTriggerType {
  slug: string;
  name?: string;
  description?: string;
}

/**
 * A toolkit's trigger types, cached per toolkit rather than per org.
 *
 * listTypes resolves on the toolkit slug alone, so one fetch serves every
 * customer — the same reasoning as the tool catalog. Without this, opening the
 * triggers page with fifteen connections would cost fifteen provider calls
 * every time.
 */
const getTriggerTypes = async (toolkitSlug: string): Promise<RawTriggerType[]> => {
  const cached = await repo.findTriggerCatalog(toolkitSlug);
  if (cached && Date.now() - cached.fetchedAt.getTime() < TRIGGER_CATALOG_TTL_MS) {
    return cached.triggers as unknown as RawTriggerType[];
  }
  try {
    const response = (await composioClient.triggers.listTypes({
      toolkits: [toolkitSlug],
      limit: 50,
    } as never)) as { items?: RawTriggerType[] };
    const items = response.items ?? [];
    await repo
      .upsertTriggerCatalog(toolkitSlug, McpProvider.COMPOSIO, items)
      .catch((err) => console.error("[triggers] catalog persist failed", err));
    return items;
  } catch (err) {
    console.error("[triggers] listTypes failed", { toolkitSlug, error: err });
    // Serve whatever is cached, however old, rather than showing a connected
    // integration as having no triggers because one call failed.
    return (cached?.triggers as unknown as RawTriggerType[] | undefined) ?? [];
  }
};

/**
 * Every trigger the org can actually use: discovered from each connected
 * integration, rather than a fixed list.
 *
 * Curated definitions still win where they exist — a hand-written instruction
 * that knows what "a new email arrives" means beats a generic one — but they
 * are now overrides on discovery instead of the whole universe. Verified
 * across the catalog: 21 of 46 integrations expose triggers, 191 types in
 * total, so a fixed list of seven was hiding most of what is possible.
 */
export const listTriggers = async (organizationId: string): Promise<TriggerSummary[]> => {
  const [connections, subscriptions] = await Promise.all([
    prisma.mcpConnection.findMany({
      where: { organizationId, status: "CONNECTED" },
      select: { integrationSlug: true, toolkitSlug: true },
    }),
    prisma.mcpTriggerSubscription.findMany({ where: { organizationId } }),
  ]);
  const bySlug = new Map(subscriptions.map((s) => [s.triggerSlug, s]));

  const perConnection = await Promise.all(
    connections.map(async (conn) => {
      const entry = getIntegrationBySlug(conn.integrationSlug);
      if (!entry) return [];
      // An integration can serve several agents; the first is the one whose
      // tools it primarily belongs to.
      const agentSlug = (entry.primaryAgent ?? entry.agents?.[0]) as string | undefined;
      if (!agentSlug) return [];
      const agent = agentSlug.toUpperCase() as Agent;

      const types = await getTriggerTypes(conn.toolkitSlug);
      return types.map((type): TriggerSummary => {
        const curated = findTriggerDefinitionBySlug(type.slug);
        const sub = bySlug.get(type.slug);
        const label = curated?.label ?? humanizeTriggerName(type.name ?? "", type.slug);
        return {
          id: curated?.id ?? type.slug,
          integrationSlug: conn.integrationSlug,
          integrationName: entry.name,
          triggerSlug: type.slug,
          label,
          description:
            curated?.description ??
            type.description ??
            `${entry.name} event — the agent decides whether it needs anything.`,
          agent: curated?.agent ?? agent,
          curated: Boolean(curated),
          subscribed: Boolean(sub),
          enabled: sub?.enabled ?? false,
          instruction: sub?.instruction ?? null,
          lastEventAt: sub?.lastEventAt?.toISOString() ?? null,
          lastError: sub?.lastError ?? null,
        };
      });
    }),
  );

  return perConnection
    .flat()
    .sort(
      (a, b) =>
        a.integrationName.localeCompare(b.integrationName) || a.label.localeCompare(b.label),
    );
};

/**
 * Resolves a trigger id from the API into everything needed to act on it.
 *
 * The id is a curated id where one exists and the provider slug otherwise, so
 * this looks both up — and falls back to the org's own connections to find
 * which integration a discovered slug belongs to. Returning null means the id
 * is not usable by this org, which is the same answer as "unknown".
 */
const resolveTrigger = async (
  organizationId: string,
  triggerId: string,
): Promise<{
  triggerSlug: string;
  integrationSlug: string;
  agent: Agent;
  label: string;
  prompt: string;
} | null> => {
  const curated = findTriggerDefinition(triggerId);
  if (curated) {
    return {
      triggerSlug: curated.triggerSlug,
      integrationSlug: curated.integrationSlug,
      agent: curated.agent,
      label: curated.label,
      prompt: curated.prompt,
    };
  }

  const all = await listTriggers(organizationId);
  const found = all.find((t) => t.id === triggerId || t.triggerSlug === triggerId);
  if (!found) return null;
  return {
    triggerSlug: found.triggerSlug,
    integrationSlug: found.integrationSlug,
    agent: found.agent,
    label: found.label,
    prompt: genericTriggerPrompt(found.label, found.integrationName),
  };
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

/**
 * Refuses to arm a trigger that could never fire.
 *
 * The webhook endpoint rejects every delivery when COMPOSIO_WEBHOOK_SECRET is
 * unset — correctly, since parse() accepts unsigned payloads without one. But
 * subscribing did not check, so turning a trigger on succeeded, Composio
 * happily delivered, and every event died at the door with nothing on screen
 * to explain it.
 *
 * Checked here rather than at delivery time because this is the last moment a
 * human is present to read the answer.
 */
const assertWebhookConfigured = (): void => {
  if (!process.env.COMPOSIO_WEBHOOK_SECRET) {
    throw new BadRequestError(
      "Triggers aren't set up on this server yet: COMPOSIO_WEBHOOK_SECRET is " +
        "missing, so incoming events can't be verified and would be rejected. " +
        "Set it from the secret returned by Composio's webhook subscription, " +
        "then try again.",
    );
  }
};

export const subscribeTrigger = async (
  organizationId: string,
  userId: string,
  triggerId: string,
  config?: Record<string, unknown>,
): Promise<TriggerSummary> => {
  const def = await resolveTrigger(organizationId, triggerId);
  if (!def) throw new NotFoundError("Unknown trigger");

  // Before creating anything, local or remote: an armed trigger whose events
  // are all rejected is worse than a trigger that refused to arm.
  assertWebhookConfigured();

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
        triggerConfig: { ...(config ?? {}) },
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
  const def = await resolveTrigger(organizationId, triggerId);
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
  const def = await resolveTrigger(organizationId, triggerId);
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
    integrationSlug: string;
    instruction: string | null;
  },
  event: InboundEvent,
): Promise<void> => {
  // A discovered trigger has no curated entry, which is normal now — the
  // instruction comes from the subscription or the generic template instead.
  const curated = findTriggerDefinitionBySlug(subscription.triggerSlug);
  const def = {
    agent: subscription.agent,
    label: humanizeTriggerName("", subscription.triggerSlug),
    prompt:
      subscription.instruction ??
      curated?.prompt ??
      genericTriggerPrompt(
        humanizeTriggerName("", subscription.triggerSlug),
        subscription.integrationSlug,
      ),
  };

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
      userMessage: buildAgentPrompt(def.prompt, event.data),
      rawHistory: [],
      // Not a conversation — see AgentCallOptions.skipMemory.
      skipMemory: true,
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
const buildAgentPrompt = (instruction: string, data: Record<string, unknown>): string => {
  const payload = JSON.stringify(data, null, 2).slice(0, 8000);
  return `${instruction}\n\nHere is the event:\n\`\`\`json\n${payload}\n\`\`\``;
};
