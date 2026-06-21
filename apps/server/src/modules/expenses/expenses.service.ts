import * as repo from "./expenses.repository.js";
import { computeNextRun } from "../tasks/tasks.service.js";
import type {
  ExpenseCategory,
  SplitType,
} from "../../../prisma/generated/prisma/client.js";

// ── FX conversion ─────────────────────────────────────────────────────────────

const fxCache = new Map<string, { rate: number; ts: number }>();
const FX_TTL = 60 * 60 * 1000; // 1 hour

async function toUsd(amount: number, currency: string): Promise<number> {
  if (currency === "USD") return amount;
  const key = currency.toUpperCase();
  const cached = fxCache.get(key);
  if (cached && Date.now() - cached.ts < FX_TTL) {
    return parseFloat((amount * cached.rate).toFixed(4));
  }
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${key}&to=USD`);
    if (!res.ok) throw new Error("FX fetch failed");
    const data = (await res.json()) as { rates: Record<string, number> };
    const rate = data.rates["USD"] ?? 1;
    fxCache.set(key, { rate, ts: Date.now() });
    return parseFloat((amount * rate).toFixed(4));
  } catch {
    return amount;
  }
}

// ── Groups ────────────────────────────────────────────────────────────────────

export const listGroups = repo.listGroups;
export const getGroup = repo.getGroup;

export async function createGroup(
  createdById: string,
  data: { name: string; description?: string; currency: string; memberNames: string[] },
) {
  const group = await repo.createGroup({
    name: data.name,
    description: data.description,
    currency: data.currency,
    createdById,
  });
  if (data.memberNames.length > 0) {
    await Promise.all(data.memberNames.map((n) => repo.addMember(group.id, n).catch(() => null)));
  }
  return repo.getGroup(group.id);
}

export const addMember = repo.addMember;
export const removeMember = repo.removeMember;

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function listExpenses(
  groupId: string,
  filters: {
    category?: string;
    paidByMemberId?: string;
    from?: string;
    to?: string;
    page: number;
    limit: number;
  },
) {
  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await Promise.all([
    repo.listExpenses(groupId, {
      category: filters.category as ExpenseCategory | undefined,
      paidByMemberId: filters.paidByMemberId,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
      skip,
      take: filters.limit,
    }),
    repo.countExpenses(groupId, {
      category: filters.category as ExpenseCategory | undefined,
      paidByMemberId: filters.paidByMemberId,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
    }),
  ]);
  return { items, total, page: filters.page, limit: filters.limit };
}

export async function createExpense(
  groupId: string,
  input: {
    title: string;
    amount: number;
    currency: string;
    category: string;
    paidByMemberId: string;
    receiptUrl?: string;
    notes?: string;
    date: string;
    isRecurring: boolean;
    cronExpression?: string;
    splits: { memberId: string; splitType: string; shareAmount: number }[];
  },
) {
  const amountUsd = await toUsd(input.amount, input.currency);

  const splits = await Promise.all(
    input.splits.map(async (s) => ({
      memberId: s.memberId,
      splitType: s.splitType as SplitType,
      shareAmount: s.shareAmount,
      shareAmountUsd: await toUsd(s.shareAmount, input.currency),
    })),
  );

  const nextRunAt =
    input.isRecurring && input.cronExpression
      ? computeNextRun(input.cronExpression) ?? undefined
      : undefined;

  return repo.createExpense({
    groupId,
    title: input.title,
    amount: input.amount,
    currency: input.currency,
    amountUsd,
    category: input.category as ExpenseCategory,
    paidByMemberId: input.paidByMemberId,
    receiptUrl: input.receiptUrl,
    notes: input.notes,
    date: new Date(input.date),
    isRecurring: input.isRecurring,
    cronExpression: input.cronExpression,
    nextRunAt,
    splits,
  });
}

export async function updateExpense(
  id: string,
  input: Partial<{
    title: string;
    amount: number;
    currency: string;
    category: string;
    paidByMemberId: string;
    receiptUrl: string;
    notes: string;
    date: string;
    isRecurring: boolean;
    cronExpression: string;
    splits: { memberId: string; splitType: string; shareAmount: number }[];
  }>,
) {
  const existing = await repo.getExpense(id);
  if (!existing) return null;

  const currency = input.currency ?? existing.currency;
  const amount = input.amount ?? existing.amount;
  const amountUsd = input.amount !== undefined ? await toUsd(amount, currency) : undefined;

  let splits: { memberId: string; splitType: SplitType; shareAmount: number; shareAmountUsd: number }[] | undefined;
  if (input.splits) {
    splits = await Promise.all(
      input.splits.map(async (s) => ({
        memberId: s.memberId,
        splitType: s.splitType as SplitType,
        shareAmount: s.shareAmount,
        shareAmountUsd: await toUsd(s.shareAmount, currency),
      })),
    );
  }

  const nextRunAt =
    input.isRecurring && input.cronExpression
      ? (computeNextRun(input.cronExpression) ?? undefined)
      : undefined;

  return repo.updateExpense(id, {
    ...(input.title !== undefined && { title: input.title }),
    ...(amount !== undefined && { amount }),
    ...(amountUsd !== undefined && { amountUsd }),
    ...(currency !== undefined && { currency }),
    ...(input.category !== undefined && { category: input.category as ExpenseCategory }),
    ...(input.paidByMemberId !== undefined && { paidByMemberId: input.paidByMemberId }),
    ...(input.receiptUrl !== undefined && { receiptUrl: input.receiptUrl }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.date !== undefined && { date: new Date(input.date) }),
    ...(input.isRecurring !== undefined && { isRecurring: input.isRecurring }),
    ...(input.cronExpression !== undefined && { cronExpression: input.cronExpression }),
    ...(nextRunAt !== undefined && { nextRunAt }),
    splits,
  });
}

export const deleteExpense = repo.deleteExpense;
export const getExpense = repo.getExpense;

// ── Balance calculation ───────────────────────────────────────────────────────

type MemberBalance = { memberId: string; net: number };
type Transfer = { fromMemberId: string; toMemberId: string; amount: number };

export async function getBalances(groupId: string) {
  const [group, expenses, settlements] = await Promise.all([
    repo.getGroup(groupId),
    repo.getGroupExpensesForBalance(groupId),
    repo.getGroupSettlements(groupId),
  ]);

  const groupCurrency = group?.currency ?? "USD";
  const net: Record<string, number> = {};

  for (const exp of expenses) {
    // Use original amount when currency matches the group; fall back to USD otherwise
    const value = exp.currency === groupCurrency ? exp.amount : exp.amountUsd;
    net[exp.paidByMemberId] = (net[exp.paidByMemberId] ?? 0) + value;
    for (const split of exp.splits) {
      const splitValue = exp.currency === groupCurrency ? split.shareAmount : split.shareAmountUsd;
      net[split.memberId] = (net[split.memberId] ?? 0) - splitValue;
    }
  }

  for (const s of settlements) {
    const value = s.currency === groupCurrency ? s.amount : s.amountUsd;
    net[s.fromMemberId] = (net[s.fromMemberId] ?? 0) - value;
    net[s.toMemberId] = (net[s.toMemberId] ?? 0) + value;
  }

  const balances: MemberBalance[] = Object.entries(net).map(([memberId, n]) => ({
    memberId,
    net: parseFloat(n.toFixed(2)),
  }));

  const creditors = balances
    .filter((b) => b.net > 0.01)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.net - a.net);
  const debtors = balances
    .filter((b) => b.net < -0.01)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.net - b.net);

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!;
    const debtor = debtors[di]!;
    const amount = Math.min(creditor.net, Math.abs(debtor.net));
    transfers.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      amount: parseFloat(amount.toFixed(2)),
    });
    creditor.net -= amount;
    debtor.net += amount;
    if (creditor.net < 0.01) ci++;
    if (Math.abs(debtor.net) < 0.01) di++;
  }

  return { currency: groupCurrency, balances, transfers };
}

// ── Settlements ───────────────────────────────────────────────────────────────

export async function createSettlement(
  groupId: string,
  input: {
    fromMemberId: string;
    toMemberId: string;
    amount: number;
    currency: string;
    method?: string;
    notes?: string;
    settledAt?: string;
  },
) {
  const amountUsd = await toUsd(input.amount, input.currency);
  return repo.createSettlement({
    groupId,
    fromMemberId: input.fromMemberId,
    toMemberId: input.toMemberId,
    amount: input.amount,
    currency: input.currency,
    amountUsd,
    method: input.method,
    notes: input.notes,
    settledAt: input.settledAt ? new Date(input.settledAt) : new Date(),
  });
}

// ── Activity feed ─────────────────────────────────────────────────────────────

export async function getActivityFeed(groupId: string) {
  const { expenses, settlements } = await repo.getActivityFeed(groupId);

  type ActivityItem =
    | { type: "expense"; ts: Date; data: (typeof expenses)[0] }
    | { type: "settlement"; ts: Date; data: (typeof settlements)[0] };

  const items: ActivityItem[] = [
    ...expenses.map((e) => ({ type: "expense" as const, ts: e.date, data: e })),
    ...settlements.map((s) => ({ type: "settlement" as const, ts: s.settledAt, data: s })),
  ];

  items.sort((a, b) => b.ts.getTime() - a.ts.getTime());
  return items;
}

// ── Stats (charts) ────────────────────────────────────────────────────────────

export async function getGroupStats(groupId: string) {
  const [group, raw] = await Promise.all([repo.getGroup(groupId), repo.getGroupStats(groupId)]);
  const groupCurrency = group?.currency ?? "USD";

  const val = (e: { amount: number; currency: string; amountUsd: number }) =>
    e.currency === groupCurrency ? e.amount : e.amountUsd;

  const monthlyMap: Record<string, number> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap[key] = 0;
  }
  for (const e of raw) {
    const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}`;
    if (key in monthlyMap) monthlyMap[key] += val(e);
  }
  const monthlyTrend = Object.entries(monthlyMap).map(([month, total]) => ({
    month,
    total: parseFloat(total.toFixed(2)),
  }));

  const catMap: Record<string, number> = {};
  for (const e of raw) {
    catMap[e.category] = (catMap[e.category] ?? 0) + val(e);
  }
  const byCategory = Object.entries(catMap).map(([category, total]) => ({
    category,
    total: parseFloat(total.toFixed(2)),
  }));

  const spenderMap: Record<string, { name: string; total: number }> = {};
  for (const e of raw) {
    const entry = spenderMap[e.paidByMemberId];
    if (entry) {
      entry.total += val(e);
    } else {
      spenderMap[e.paidByMemberId] = { name: e.paidByMember.name, total: val(e) };
    }
  }
  const topSpenders = Object.entries(spenderMap)
    .map(([memberId, { name, total }]) => ({
      memberId,
      name,
      total: parseFloat(total.toFixed(2)),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const total = parseFloat(raw.reduce((s, e) => s + val(e), 0).toFixed(2));

  return { currency: groupCurrency, total, monthlyTrend, byCategory, topSpenders };
}

// ── CSV export ────────────────────────────────────────────────────────────────

export async function exportCsv(groupId: string): Promise<string> {
  const { items } = await listExpenses(groupId, { page: 1, limit: 10000 });
  const header = "Date,Title,Category,Paid By,Amount,Currency,Amount (USD),Notes";
  const rows = items.map((e) => {
    const splitSummary = e.splits.map((s) => `${s.member.name}:${s.shareAmount}`).join("|");
    return [
      e.date.toISOString().split("T")[0],
      `"${e.title.replace(/"/g, '""')}"`,
      e.category,
      e.paidByMember.name,
      e.amount,
      e.currency,
      e.amountUsd,
      `"${(e.notes ?? "").replace(/"/g, '""')}"`,
      `"${splitSummary}"`,
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

// ── Rex AI analysis ───────────────────────────────────────────────────────────

export async function buildExpenseContext(groupId: string): Promise<string> {
  const stats = await getGroupStats(groupId);
  return JSON.stringify(
    {
      totalSpend: stats.total,
      currency: stats.currency,
      last6MonthsTrend: stats.monthlyTrend,
      spendByCategory: stats.byCategory,
      topSpenders: stats.topSpenders,
    },
    null,
    2,
  );
}

// ── Recurring expense cron ────────────────────────────────────────────────────

export async function processRecurringExpenses() {
  const due = await repo.claimDueRecurringExpenses();
  for (const tmpl of due) {
    try {
      const splits = await repo.getExpenseSplitsForClone(tmpl.id);
      const nextRunAt = tmpl.cronExpression
        ? (computeNextRun(tmpl.cronExpression) ?? undefined)
        : undefined;

      await repo.createExpense({
        groupId: tmpl.groupId,
        title: tmpl.title,
        amount: tmpl.amount,
        currency: tmpl.currency,
        amountUsd: tmpl.amountUsd,
        category: tmpl.category,
        paidByMemberId: tmpl.paidByMemberId,
        notes: tmpl.notes ?? undefined,
        date: new Date(),
        isRecurring: true,
        cronExpression: tmpl.cronExpression ?? undefined,
        nextRunAt,
        splits: splits.map((s) => ({
          memberId: s.memberId,
          splitType: s.splitType,
          shareAmount: s.shareAmount,
          shareAmountUsd: s.shareAmountUsd,
        })),
      });

      if (nextRunAt) {
        await repo.updateExpense(tmpl.id, { nextRunAt });
      }
    } catch (err) {
      console.error(`[expenses-cron] Failed to clone recurring expense ${tmpl.id}:`, err);
    }
  }
  if (due.length > 0) {
    console.log(`[expenses-cron] Cloned ${due.length} recurring expense(s)`);
  }
}
