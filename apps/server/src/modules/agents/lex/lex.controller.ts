import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  sendMessageSchema,
  finalizeSourceSchema,
  analyzeContractSchema,
  draftDocumentSchema,
  exportDocumentSchema,
  stampLetterheadSchema,
  explainSchema,
  legalResearchSchema,
  complianceCheckSchema,
  queryDocumentSchema,
  draftReplySchema,
  listSourcesQuerySchema,
  preferencesSchema,
  settingsSchema,
  obligationUpdateSchema,
  remindersSchema,
  activitySchema,
} from "./lex.schema.js";
import * as lexMemory from "./lex.memory.js";
import { NotFoundError } from "../../../common/errors/notFound.js";
import * as lexService from "./lex.service.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";

const requireAuthContext = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

export const msgLex = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = sendMessageSchema.parse(req.body);
  const result = await lexService.sendMessage(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const msgLexStream = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = sendMessageSchema.parse(req.body);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let clientClosed = false;
  res.on("close", () => {
    clientClosed = true;
  });

  try {
    for await (const evt of lexService.streamMessage(userId, organizationId, input)) {
      if (clientClosed) break;
      res.write(`event: ${evt.event}\ndata: ${evt.data}\n\n`);
    }
  } catch (err) {
    if (!clientClosed) {
      const message = err instanceof Error ? err.message : String(err);
      res.write(`event: error\ndata: ${JSON.stringify({ message, code: "server_error" })}\n\n`);
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
};

export const getLexMessages = async (req: Request, res: Response) => {
  const organizationId =
    (req.query.organizationId as string) ?? req.organizationId;
  if (!organizationId) {
    throw new BadRequestError("Organization ID is required");
  }
  const before = req.query.before as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const messages = await lexService.listMessages(organizationId, { before, limit });
  res.status(StatusCodes.OK).json(messages);
};

export const finalizeSource = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = finalizeSourceSchema.parse(req.body);
  const result = await lexService.finalizeSource(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const listSources = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const query = listSourcesQuerySchema.parse(req.query);
  const result = await lexService.listSources(userId, organizationId, query);
  res.status(StatusCodes.OK).json(result);
};

export const getSource = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const { id } = req.params as { id: string };
  res.status(StatusCodes.OK).json(await lexService.getSourceDetail(userId, organizationId, id));
};

export const versionCandidates = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const name = String(req.query.name ?? "").slice(0, 200);
  res.status(StatusCodes.OK).json(await lexMemory.findVersionCandidates(userId, organizationId, name));
};

export const compareVersion = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const { id } = req.params as { id: string };
  const result = await lexMemory.compareWithPreviousVersion({ organizationId, userId, sourceRowId: id, force: req.body?.force === true });
  if (!result) throw new NotFoundError("This document has no previous version to compare with");
  res.status(StatusCodes.OK).json(result);
};

export const addReminders = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const { id } = req.params as { id: string };
  const input = remindersSchema.parse(req.body);
  const result = await lexMemory.enableReminders({ organizationId, userId, sourceRowId: id, ...input });
  if (!result) throw new NotFoundError("Document not found");
  res.status(StatusCodes.OK).json(result.map((o) => ({ ...o, dueDate: o.dueDate?.toISOString() ?? null })));
};

export const updateObligation = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const { id } = req.params as { id: string };
  const input = obligationUpdateSchema.parse(req.body);
  const result = await lexMemory.updateObligation({ organizationId, userId, id, ...input });
  if (!result) throw new NotFoundError("Date not found");
  res.status(StatusCodes.OK).json({ ...result, dueDate: result.dueDate?.toISOString() ?? null });
};

export const getWatch = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  res.status(StatusCodes.OK).json(await lexMemory.buildWatch(userId, organizationId));
};

export const getBrief = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  res.status(StatusCodes.OK).json(await lexMemory.buildBrief(userId, organizationId));
};

export const getPreferences = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  res.status(StatusCodes.OK).json(await lexMemory.listPreferences(organizationId));
};

export const putPreferences = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = preferencesSchema.parse(req.body);
  res.status(StatusCodes.OK).json(await lexMemory.savePreferences(organizationId, input.values, { userId }));
};

export const getSettings = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  res.status(StatusCodes.OK).json(await lexMemory.getSettings(organizationId));
};

export const putSettings = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = settingsSchema.parse(req.body);
  res.status(StatusCodes.OK).json(await lexMemory.saveSettings(organizationId, userId, input));
};

const ACTIVITY_LABELS: Record<string, string> = {
  exported_review: "Exported the one-page review",
  copied_reply: "Copied the negotiation email",
  shared_with_counsel: "Shared the review with counsel",
  opened_version_changes: "Opened the version changes",
};

export const recordActivity = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = activitySchema.parse(req.body);
  await lexMemory.logActivity({
    organizationId,
    sourceRowId: input.sourceRowId ?? null,
    actor: "user",
    userId,
    action: ACTIVITY_LABELS[input.action],
    detail: input.detail,
  });
  res.status(StatusCodes.OK).json({ ok: true });
};

export const deleteSource = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const { id } = req.params as { id: string };
  if (!id) throw new BadRequestError("Source id is required");
  const result = await lexService.deleteSource(userId, organizationId, id);
  res.status(StatusCodes.OK).json(result);
};

export const queryDocument = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = queryDocumentSchema.parse(req.body);
  const result = await lexService.queryDocument(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const analyzeContract = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = analyzeContractSchema.parse(req.body);
  const result = await lexService.analyzeContract(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const draftReply = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = draftReplySchema.parse(req.body);
  const result = await lexService.draftReply(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const draftDocument = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = draftDocumentSchema.parse(req.body);
  const result = await lexService.draftDocument(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const exportDocument = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = exportDocumentSchema.parse(req.body);
  const result = await lexService.exportDocument(organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const stampLetterhead = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = stampLetterheadSchema.parse(req.body);
  const result = await lexService.stampLetterhead(organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const explain = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = explainSchema.parse(req.body);
  const result = await lexService.explainLegalText(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const legalResearch = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = legalResearchSchema.parse(req.body);
  const result = await lexService.legalResearch(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const complianceCheck = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = complianceCheckSchema.parse(req.body);
  const result = await lexService.complianceCheck(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};
