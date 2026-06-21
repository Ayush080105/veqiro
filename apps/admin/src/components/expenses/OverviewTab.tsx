"use client";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from "recharts";
import { apiFetch } from "@/lib/api";
import type { GroupStats } from "./types";
import { CATEGORY_COLORS } from "./types";

function fmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OverviewTab({ groupId }: { groupId: string }) {
  const { data: stats, isLoading } = useQuery<GroupStats>({
    queryKey: ["expenses", "stats", groupId],
    queryFn: () => apiFetch(`/expenses/groups/${groupId}/stats`),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const currency = stats.currency;
  const tickFmt = (v: number) => `${currency} ${v.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-6">
      {/* Stat summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Total Spend</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">{fmt(stats.total, currency)}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Categories</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">{stats.byCategory.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Top Category</p>
          <p className="mt-1.5 text-sm font-semibold">
            {stats.byCategory.sort((a, b) => b.total - a.total)[0]?.category ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Top Spender</p>
          <p className="mt-1.5 text-sm font-semibold truncate">
            {stats.topSpenders[0]?.name ?? "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly trend */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="mb-4 text-sm font-semibold">Monthly Spend ({currency})</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={tickFmt} width={90} />
              <Tooltip formatter={(v: number) => fmt(v, currency)} />
              <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Spend by category */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="mb-4 text-sm font-semibold">Spend by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={stats.byCategory}
                dataKey="total"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {stats.byCategory.map((entry) => (
                  <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? "#95A5A6"} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v, currency)} />
              <Legend formatter={(v) => v.toLowerCase()} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top spenders */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="mb-4 text-sm font-semibold">Top Spenders ({currency} paid)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={stats.topSpenders} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tickFmt} width={90} />
            <Tooltip formatter={(v: number) => fmt(v, currency)} />
            <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
