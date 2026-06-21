import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import * as service from "./expenses.service.js";
import * as repo from "./expenses.repository.js";
import {
  createGroupSchema,
  addMemberSchema,
  createExpenseSchema,
  updateExpenseSchema,
  createSettlementSchema,
  listExpensesQuerySchema,
  askRexSchema,
} from "./expenses.schemas.js";
import { buildExpenseContext } from "./expenses.service.js";
import * as rexService from "../agents/rex/rex.service.js";

const requireUser = (req: Request) => {
  if (!req.userId) throw new UnauthenticatedError("Missing user context");
  return req.userId;
};

const requireAuthContext = (req: Request) => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user or organization context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

const getParam = (req: Request, name: string) => {
  const value = req.params[name];
  if (!value || Array.isArray(value)) {
    throw new BadRequestError(`Missing route parameter: ${name}`);
  }
  return value;
};

// ── Groups ────────────────────────────────────────────────────────────────────

export const listGroups = async (_req: Request, res: Response) => {
  const groups = await service.listGroups();
  res.json(groups);
};

export const createGroup = async (req: Request, res: Response) => {
  const userId = requireUser(req);
  const input = createGroupSchema.parse(req.body);
  const group = await service.createGroup(userId, input);
  res.status(StatusCodes.CREATED).json(group);
};

export const getGroup = async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const group = await service.getGroup(id);
  if (!group) { res.status(StatusCodes.NOT_FOUND).json({ error: "Group not found" }); return; }
  res.json(group);
};

export const addMember = async (req: Request, res: Response) => {
  const groupId = getParam(req, "id");
  const input = addMemberSchema.parse(req.body);
  await service.addMember(groupId, input.name);
  res.status(StatusCodes.CREATED).json({ ok: true });
};

export const removeMember = async (req: Request, res: Response) => {
  const groupId = getParam(req, "id");
  const name = getParam(req, "name");
  await service.removeMember(groupId, name);
  res.status(StatusCodes.NO_CONTENT).send();
};

// ── Expenses ──────────────────────────────────────────────────────────────────

export const listExpenses = async (req: Request, res: Response) => {
  const groupId = getParam(req, "id");
  const filters = listExpensesQuerySchema.parse(req.query);
  const result = await service.listExpenses(groupId, filters);
  res.json(result);
};

export const createExpense = async (req: Request, res: Response) => {
  const groupId = getParam(req, "id");
  const input = createExpenseSchema.parse(req.body);
  const expense = await service.createExpense(groupId, input);
  res.status(StatusCodes.CREATED).json(expense);
};

export const updateExpense = async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const input = updateExpenseSchema.parse(req.body);
  const expense = await service.updateExpense(id, input);
  if (!expense) { res.status(StatusCodes.NOT_FOUND).json({ error: "Expense not found" }); return; }
  res.json(expense);
};

export const deleteExpense = async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  await service.deleteExpense(id);
  res.status(StatusCodes.NO_CONTENT).send();
};

// ── Balances ──────────────────────────────────────────────────────────────────

export const getBalances = async (req: Request, res: Response) => {
  const groupId = getParam(req, "id");
  const result = await service.getBalances(groupId);
  res.json(result);
};

// ── Settlements ───────────────────────────────────────────────────────────────

export const createSettlement = async (req: Request, res: Response) => {
  const groupId = getParam(req, "id");
  const input = createSettlementSchema.parse(req.body);
  const settlement = await service.createSettlement(groupId, input);
  res.status(StatusCodes.CREATED).json(settlement);
};

// ── Activity ──────────────────────────────────────────────────────────────────

export const getActivity = async (req: Request, res: Response) => {
  const groupId = getParam(req, "id");
  const feed = await service.getActivityFeed(groupId);
  res.json(feed);
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export const getStats = async (req: Request, res: Response) => {
  const groupId = getParam(req, "id");
  const stats = await service.getGroupStats(groupId);
  res.json(stats);
};

// ── Export ────────────────────────────────────────────────────────────────────

export const exportData = async (req: Request, res: Response) => {
  const groupId = getParam(req, "id");
  const format = (req.query["format"] as string) ?? "csv";
  const group = await service.getGroup(groupId);

  if (format === "csv") {
    const csv = await service.exportCsv(groupId);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="expenses-${groupId}.csv"`);
    res.send(csv);
    return;
  }

  res.status(StatusCodes.BAD_REQUEST).json({ error: "Unsupported format. Use ?format=csv" });
};

// ── Rex AI ────────────────────────────────────────────────────────────────────

export const askRex = async (req: Request, res: Response) => {
  const groupId = getParam(req, "id");
  const { userId, organizationId } = requireAuthContext(req);
  const input = askRexSchema.parse(req.body);
  const context = await buildExpenseContext(groupId);
  const prompt = `You are Rex, a finance AI assistant. Below is the expense data for the team group.\n\n<expense_data>\n${context}\n</expense_data>\n\nQuestion: ${input.question}`;

  try {
    const message = await rexService.sendMessage(userId, organizationId, { content: prompt });
    const answer = message.content ?? "No response from Rex.";
    res.json({ answer, reply: answer });
  } catch {
    // Fallback: simple heuristic answer from pre-computed stats
    const answer = `Here is the expense summary:\n\n${context}`;
    res.json({ answer, reply: answer });
  }
};
