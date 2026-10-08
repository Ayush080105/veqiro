import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import env from "../../../../config/env.js";
import { BadRequestError } from "../../../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../../../common/errors/unauthenticated.js";
import { secretsConfigured } from "../../../../common/utils/secretBox.js";
import { buildAuthorizeUrl, exchangeCode, oauthConfigured, readCallbackState, safeReturnTo } from "./hubspot.oauth.js";
import { hubspotConnections, hubspotSync } from "./hubspot.runtime.js";

const auth = (req: Request) => {
  if (!req.userId || !req.organizationId) throw new UnauthenticatedError("Missing user context");
  return { userId: req.userId, organizationId: req.organizationId };
};

const param = (req: Request, name: string): string => {
  const v = req.params[name];
  if (typeof v !== "string" || !v) throw new BadRequestError(`${name} is required`);
  return v;
};

const tokenSchema = z.object({ token: z.string().min(1).max(4000), connectionId: z.string().max(60).optional() });
const oauthStartSchema = z.object({ returnTo: z.string().max(500).optional(), connectionId: z.string().max(60).optional() });
const selectionSchema = z.object({
  objects: z.array(z.object({
    type: z.string().trim().min(1).max(60),
    extra: z.array(z.string().max(120)).max(200).default([]),
    includePii: z.array(z.string().max(120)).max(60).default([]),
  })).min(1).max(30),
});
const syncSchema = z.object({
  mode: z.enum(["auto", "incremental", "full"]).default("auto"),
  wait: z.boolean().default(false),
});
const disconnectSchema = z.object({ mode: z.enum(["keep", "delete"]).default("keep") });

/** Each connect attempt makes about a dozen calls to HubSpot, so cap how often one workspace can try. */
const attempts = new Map<string, number[]>();
function allowConnectAttempt(organizationId: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(organizationId) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 10) return false;
  recent.push(now);
  attempts.set(organizationId, recent);
  return true;
}

/** After a reconnect, catch the datasets up right away instead of waiting for the next tick. */
const resyncInBackground = (organizationId: string, connectionId: string) =>
  void Promise.resolve().then(() => hubspotSync.syncConnection(organizationId, connectionId)).catch((err) => console.error("[rex-hubspot] resync after reconnect", err));

export const list = async (req: Request, res: Response) => {
  const { organizationId } = auth(req);
  res.status(StatusCodes.OK).json({
    oauthAvailable: oauthConfigured() && secretsConfigured(),
    encryptionConfigured: secretsConfigured(),
    connections: await hubspotConnections.listConnections(organizationId),
  });
};

export const connectToken = async (req: Request, res: Response) => {
  const { userId, organizationId } = auth(req);
  const { token, connectionId } = tokenSchema.parse(req.body);
  if (!allowConnectAttempt(organizationId)) throw new BadRequestError("Too many connection attempts. Try again in a few minutes.");
  const out = await hubspotConnections.connectWithToken({ organizationId, userId, token, replaceConnectionId: connectionId });
  if (connectionId) resyncInBackground(organizationId, out.connectionId);
  res.status(connectionId ? StatusCodes.OK : StatusCodes.CREATED).json(out);
};

export const oauthStart = async (req: Request, res: Response) => {
  const { userId, organizationId } = auth(req);
  if (!oauthConfigured() || !secretsConfigured()) throw new BadRequestError("Connecting with HubSpot isn't enabled on this server.");
  const { returnTo, connectionId } = oauthStartSchema.parse(req.body ?? {});
  res.status(StatusCodes.OK).json({ url: buildAuthorizeUrl({ organizationId, userId, returnTo: safeReturnTo(returnTo), connectionId }) });
};

/** Public: HubSpot sends the browser here. Trust comes from the signed `state`, not a session. */
export const oauthCallback = async (req: Request, res: Response) => {
  const back = (path: string, params: Record<string, string>) => {
    const url = new URL(safeReturnTo(path), env.CLIENT_URL);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    res.redirect(url.toString());
  };
  const code = typeof req.query["code"] === "string" ? req.query["code"] : "";
  const state = typeof req.query["state"] === "string" ? req.query["state"] : "";
  let ctx: ReturnType<typeof readCallbackState>;
  try {
    ctx = readCallbackState(state);
  } catch {
    return back("/", { hubspot: "error", reason: "state" });
  }
  if (req.query["error"] || !code) return back(ctx.returnTo, { hubspot: "error", reason: "denied" });
  try {
    const tokens = await exchangeCode(code);
    const out = await hubspotConnections.connectWithOAuthTokens({
      organizationId: ctx.organizationId, userId: ctx.userId, tokens, replaceConnectionId: ctx.connectionId,
    });
    if (ctx.connectionId) resyncInBackground(ctx.organizationId, out.connectionId);
    return back(ctx.returnTo, { hubspot: "connected", connection: out.connectionId });
  } catch (err) {
    console.error("[rex-hubspot] oauth callback failed", err instanceof Error ? err.message : err);
    return back(ctx.returnTo, { hubspot: "error", reason: "exchange" });
  }
};

export const verify = async (req: Request, res: Response) => {
  const { organizationId } = auth(req);
  res.status(StatusCodes.OK).json(await hubspotConnections.verifyConnection(organizationId, param(req, "id")));
};

export const fields = async (req: Request, res: Response) => {
  const { organizationId } = auth(req);
  res.status(StatusCodes.OK).json(await hubspotConnections.discoverFields(organizationId, param(req, "id"), param(req, "type")));
};

export const saveSelection = async (req: Request, res: Response) => {
  const { userId, organizationId } = auth(req);
  const connectionId = param(req, "id");
  const { objects } = selectionSchema.parse(req.body);
  const out = await hubspotConnections.saveSelection({ organizationId, userId, connectionId, objects });
  // Start pulling right away; the wizard watches the datasets fill in.
  for (const d of out.datasets) void hubspotSync.syncDataset(d.id).catch((err) => console.error("[rex-hubspot] first sync", err));
  res.status(StatusCodes.OK).json(out);
};

export const syncNow = async (req: Request, res: Response) => {
  const { organizationId } = auth(req);
  const { mode, wait } = syncSchema.parse(req.body ?? {});
  const out = await hubspotSync.syncConnection(organizationId, param(req, "id"), { mode, waitMs: wait ? 25_000 : undefined });
  res.status(StatusCodes.OK).json(out);
};

export const disconnect = async (req: Request, res: Response) => {
  const { organizationId } = auth(req);
  const { mode } = disconnectSchema.parse(req.query);
  await hubspotConnections.disconnect(organizationId, param(req, "id"), mode);
  res.status(StatusCodes.NO_CONTENT).end();
};
