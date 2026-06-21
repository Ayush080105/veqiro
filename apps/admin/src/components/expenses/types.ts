export type GroupMember = {
  id: string;
  groupId: string;
  name: string;
  joinedAt: string;
};

export type ExpenseSplit = {
  id: string;
  memberId: string;
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE";
  shareAmount: number;
  shareAmountUsd: number;
  member: { id: string; name: string };
};

export type Expense = {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  currency: string;
  amountUsd: number;
  category: string;
  paidByMemberId: string;
  paidByMember: { id: string; name: string };
  receiptUrl: string | null;
  notes: string | null;
  date: string;
  isRecurring: boolean;
  cronExpression: string | null;
  nextRunAt: string | null;
  createdAt: string;
  splits: ExpenseSplit[];
};

export type ExpenseGroup = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  createdAt: string;
  members: GroupMember[];
  _count?: { expenses: number };
};

export type Settlement = {
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  currency: string;
  amountUsd: number;
  method: string | null;
  notes: string | null;
  settledAt: string;
  fromMember: { id: string; name: string };
  toMember: { id: string; name: string };
};

export type BalanceResult = {
  currency: string;
  balances: { memberId: string; net: number }[];
  transfers: { fromMemberId: string; toMemberId: string; amount: number }[];
};

export type ActivityItem =
  | {
      type: "expense";
      ts: string;
      data: Expense & {
        paidByMember: { id: string; name: string };
        splits: (ExpenseSplit & { member: { id: string; name: string } })[];
      };
    }
  | { type: "settlement"; ts: string; data: Settlement };

export type GroupStats = {
  currency: string;
  total: number;
  monthlyTrend: { month: string; total: number }[];
  byCategory: { category: string; total: number }[];
  topSpenders: { memberId: string; name: string; total: number }[];
};

export const CATEGORIES = [
  "FOOD",
  "TRAVEL",
  "ACCOMMODATION",
  "OFFICE",
  "ENTERTAINMENT",
  "UTILITIES",
  "SUBSCRIPTIONS",
  "EQUIPMENT",
  "OTHER",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<string, string> = {
  FOOD: "#F06464",
  TRAVEL: "#6FCDE8",
  ACCOMMODATION: "#8A8AF0",
  OFFICE: "#1DBC87",
  ENTERTAINMENT: "#F79FD4",
  UTILITIES: "#F5C518",
  SUBSCRIPTIONS: "#FF8C42",
  EQUIPMENT: "#4ECDC4",
  OTHER: "#95A5A6",
};
