import { prisma } from "../../config/prisma.js";
import type {
  ExpenseCategory,
  SplitType,
} from "../../../prisma/generated/prisma/client.js";

const memberSelect = { id: true, name: true };

// ── Groups ────────────────────────────────────────────────────────────────────

export function listGroups() {
  return prisma.expenseGroup.findMany({
    include: {
      members: { select: { id: true, groupId: true, name: true, joinedAt: true } },
      _count: { select: { expenses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function getGroup(id: string) {
  return prisma.expenseGroup.findUnique({
    where: { id },
    include: {
      members: { select: { id: true, groupId: true, name: true, joinedAt: true } },
    },
  });
}

export function createGroup(data: {
  name: string;
  description?: string;
  currency: string;
  createdById: string;
}) {
  return prisma.expenseGroup.create({ data });
}

export function addMember(groupId: string, name: string) {
  return prisma.expenseGroupMember.create({ data: { groupId, name } });
}

export function removeMember(groupId: string, name: string) {
  return prisma.expenseGroupMember.delete({ where: { groupId_name: { groupId, name } } });
}

// ── Expenses ──────────────────────────────────────────────────────────────────

const expenseInclude = {
  paidByMember: { select: memberSelect },
  splits: { include: { member: { select: memberSelect } } },
};

export function listExpenses(
  groupId: string,
  filters: {
    category?: ExpenseCategory;
    paidByMemberId?: string;
    from?: Date;
    to?: Date;
    skip: number;
    take: number;
  },
) {
  return prisma.expense.findMany({
    where: {
      groupId,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.paidByMemberId ? { paidByMemberId: filters.paidByMemberId } : {}),
      ...(filters.from || filters.to
        ? {
            date: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: expenseInclude,
    orderBy: { date: "desc" },
    skip: filters.skip,
    take: filters.take,
  });
}

export function countExpenses(
  groupId: string,
  filters: { category?: ExpenseCategory; paidByMemberId?: string; from?: Date; to?: Date },
) {
  return prisma.expense.count({
    where: {
      groupId,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.paidByMemberId ? { paidByMemberId: filters.paidByMemberId } : {}),
      ...(filters.from || filters.to
        ? { date: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    },
  });
}

export function getExpense(id: string) {
  return prisma.expense.findUnique({ where: { id }, include: expenseInclude });
}

export async function createExpense(data: {
  groupId: string;
  title: string;
  amount: number;
  currency: string;
  amountUsd: number;
  category: ExpenseCategory;
  paidByMemberId: string;
  receiptUrl?: string;
  notes?: string;
  date: Date;
  isRecurring: boolean;
  cronExpression?: string;
  nextRunAt?: Date;
  splits: { memberId: string; splitType: SplitType; shareAmount: number; shareAmountUsd: number }[];
}) {
  const { splits, ...expenseData } = data;
  return prisma.expense.create({
    data: {
      ...expenseData,
      splits: { create: splits },
    },
    include: expenseInclude,
  });
}

export async function updateExpense(
  id: string,
  data: {
    title?: string;
    amount?: number;
    currency?: string;
    amountUsd?: number;
    category?: ExpenseCategory;
    paidByMemberId?: string;
    receiptUrl?: string;
    notes?: string;
    date?: Date;
    isRecurring?: boolean;
    cronExpression?: string;
    nextRunAt?: Date;
    splits?: { memberId: string; splitType: SplitType; shareAmount: number; shareAmountUsd: number }[];
  },
) {
  const { splits, ...expenseData } = data;
  return prisma.$transaction(async (tx) => {
    if (splits) {
      await tx.expenseSplit.deleteMany({ where: { expenseId: id } });
      await tx.expenseSplit.createMany({ data: splits.map((s) => ({ ...s, expenseId: id })) });
    }
    return tx.expense.update({ where: { id }, data: expenseData, include: expenseInclude });
  });
}

export function deleteExpense(id: string) {
  return prisma.expense.delete({ where: { id } });
}

// ── Balance data ──────────────────────────────────────────────────────────────

export function getGroupExpensesForBalance(groupId: string) {
  return prisma.expense.findMany({
    where: { groupId },
    select: {
      paidByMemberId: true,
      amount: true,
      currency: true,
      amountUsd: true,
      splits: { select: { memberId: true, shareAmount: true, shareAmountUsd: true } },
    },
  });
}

export function getGroupSettlements(groupId: string) {
  return prisma.settlement.findMany({
    where: { groupId },
    include: {
      fromMember: { select: memberSelect },
      toMember: { select: memberSelect },
    },
    orderBy: { settledAt: "desc" },
  });
}

// ── Settlements ───────────────────────────────────────────────────────────────

export function createSettlement(data: {
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  currency: string;
  amountUsd: number;
  method?: string;
  notes?: string;
  settledAt: Date;
}) {
  return prisma.settlement.create({
    data,
    include: {
      fromMember: { select: memberSelect },
      toMember: { select: memberSelect },
    },
  });
}

// ── Activity feed ─────────────────────────────────────────────────────────────

export async function getActivityFeed(groupId: string) {
  const [expenses, settlements] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId },
      include: {
        paidByMember: { select: memberSelect },
        splits: { include: { member: { select: memberSelect } } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.settlement.findMany({
      where: { groupId },
      include: {
        fromMember: { select: memberSelect },
        toMember: { select: memberSelect },
      },
      orderBy: { settledAt: "desc" },
    }),
  ]);
  return { expenses, settlements };
}

// ── Stats / charts ────────────────────────────────────────────────────────────

export async function getGroupStats(groupId: string) {
  const expenses = await prisma.expense.findMany({
    where: { groupId },
    select: {
      amount: true,
      currency: true,
      amountUsd: true,
      category: true,
      date: true,
      paidByMemberId: true,
      paidByMember: { select: memberSelect },
    },
  });
  return expenses;
}

// ── Recurring expenses cron ───────────────────────────────────────────────────

export async function claimDueRecurringExpenses() {
  return prisma.$queryRaw<
    Array<{
      id: string;
      groupId: string;
      title: string;
      amount: number;
      currency: string;
      amountUsd: number;
      category: ExpenseCategory;
      paidByMemberId: string;
      notes: string | null;
      cronExpression: string | null;
    }>
  >`
    UPDATE "expense"
    SET "nextRunAt" = NULL, "updatedAt" = NOW()
    WHERE id IN (
      SELECT id FROM "expense"
      WHERE "isRecurring" = true AND "nextRunAt" <= NOW()
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
}

export function getExpenseSplitsForClone(expenseId: string) {
  return prisma.expenseSplit.findMany({ where: { expenseId } });
}
