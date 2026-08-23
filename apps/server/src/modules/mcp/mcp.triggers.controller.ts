import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import { composioClient } from "../../lib/composio.js";
import * as triggersService from "./mcp.triggers.service.js";

const requireAuth = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

const triggerIdParamSchema = z.object({ id: z.string().min(1) });
const subscribeBodySchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
});
const enabledBodySchema = z.object({ enabled: z.boolean() });

export const listTriggers = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const triggers = await triggersService.listTriggers(organizationId);
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(triggers);
};

export const subscribeTrigger = async (req: Request, res: Response) => {
  const { organizationId, userId } = requireAuth(req);
  const { id } = triggerIdParamSchema.parse(req.params);
  const { config } = subscribeBodySchema.parse(req.body ?? {});
  const summary = await triggersService.subscribeTrigger(organizationId, userId, id, config);
  res.status(StatusCodes.OK).json(summary);
};

export const setTriggerEnabled = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = triggerIdParamSchema.parse(req.params);
  const { enabled } = enabledBodySchema.parse(req.body);
  const summary = await triggersService.setTriggerEnabled(organizationId, id, enabled);
  res.status(StatusCodes.OK).json(summary);
};

export const unsubscribeTrigger = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = triggerIdParamSchema.parse(req.params);
  await triggersService.unsubscribeTrigger(organizationId, id);
  res.status(StatusCodes.NO_CONTENT).send();
};

/**
 * Composio posts trigger events here. Public by necessity — Composio has no
 * session — so the signature is the only thing separating a real event from
 * anyone who found the URL.
 *
 * Mounted before express.json() and camelizeBody (see app.ts): verification
 * needs the exact bytes Composio signed, and camelizing would rewrite the
 * snake_case metadata keys (`trigger_slug`, `connected_account_id`) this
 * handler reads.
 */
export const handleComposioWebhook = async (req: Request, res: Response) => {
  const secret = process.env.COMPOSIO_WEBHOOK_SECRET;
  if (!secret) {
    // Refuse rather than fall back to unverified parsing: triggers.parse()
    // happily returns a payload with no secret, which would let anyone who
    // learned this URL make agents act on fabricated events.
    console.error("[triggers] COMPOSIO_WEBHOOK_SECRET is not set — rejecting delivery");
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ error: "Webhook not configured" });
    return;
  }

  let verified;
  try {
    verified = await composioClient.triggers.parse(
      { body: req.body, headers: req.headers },
      { verifySecret: secret },
    );
  } catch (err) {
    console.warn("[triggers] rejected unverified delivery", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(StatusCodes.UNAUTHORIZED).json({ error: "Invalid signature" });
    return;
  }

  const raw = verified.rawPayload as {
    id?: string;
    metadata?: Record<string, unknown>;
    data?: Record<string, unknown>;
  };
  const metadata = raw.metadata ?? {};
  const eventId = raw.id ?? (metadata.log_id as string | undefined);
  const triggerSlug = metadata.trigger_slug as string | undefined;

  if (!eventId || !triggerSlug) {
    // Acknowledged, not retried: a delivery this shape will never succeed, and
    // a non-2xx would have Composio redeliver it indefinitely.
    console.warn("[triggers] delivery missing id or trigger slug — ignoring");
    res.status(StatusCodes.OK).json({ ignored: true });
    return;
  }

  const result = await triggersService.acceptInboundEvent({
    eventId,
    triggerSlug,
    composioTriggerId: (metadata.trigger_id as string | undefined) ?? null,
    connectedAccountId: (metadata.connected_account_id as string | undefined) ?? null,
    data: raw.data ?? {},
  });

  // Always 200 once the sender is verified. The event is recorded either way,
  // and a retry of something deliberately skipped is just more load.
  res.status(StatusCodes.OK).json(result);
};
