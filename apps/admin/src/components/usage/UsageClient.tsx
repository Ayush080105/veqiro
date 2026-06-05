"use client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";

type UsageData = {
  stats: {
    totalTokens30d: number;
    totalTokensAllTime: number;
    estimatedCost30d: number;
    totalMessages30d: number;
    activeOrgs30d: number;
  };
  byAgent: Array<{
    agent: string;
    messages: number;
    tokens: number;
    estimatedCost: number;
    pctShare: number;
  }>;
  byModel: Array<{
    model: string;
    messages: number;
    tokens: number;
    estimatedCost: number;
  }>;
  topOrgs: Array<{
    orgId: string;
    orgName: string;
    subscriptionStatus: string | null;
    plan: string | null;
    messages: number;
    tokens: number;
    estimatedCost: number;
    monthlyRevenue: number;
    costRevenueRatio: number | null;
  }>;
  tokenTrend: Array<{ week: string; tokens: number; messages: number }>;
  trialVsPaid: {
    trial: { orgCount: number; avgTokens: number; avgCost: number };
    paid: { orgCount: number; avgTokens: number; avgCost: number };
  };
};

function fmt(n: number) {
  return n.toLocaleString();
}
function fmtCost(n: number) {
  return `$${n.toFixed(2)}`;
}
function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function StatChip({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{sub}</p>}
    </div>
  );
}

export function UsageClient() {
  const { data, isLoading, error } = useQuery<UsageData>({
    queryKey: ["admin", "usage"],
    queryFn: () => apiFetch<UsageData>("/admin/usage"),
  });

  if (isLoading)
    return <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>;
  if (error || !data)
    return <p className="text-sm text-red-500">Failed to load usage data.</p>;

  const { stats, byAgent, byModel, topOrgs, tokenTrend, trialVsPaid } = data;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Usage & Costs</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatChip
          label="Tokens (30d)"
          value={fmtTokens(stats.totalTokens30d)}
          sub={`${fmt(stats.totalTokens30d)} total`}
        />
        <StatChip
          label="Est. LLM cost (30d)"
          value={fmtCost(stats.estimatedCost30d)}
          sub="est. blended rate"
        />
        <StatChip label="Messages (30d)" value={fmt(stats.totalMessages30d)} />
        <StatChip
          label="Active orgs (30d)"
          value={fmt(stats.activeOrgs30d)}
          sub={`all-time: ${fmtTokens(stats.totalTokensAllTime)} tokens`}
        />
      </div>

      {/* Token trend chart */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold">Token Consumption (12 weeks)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={tokenTrend} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--vq-violet)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--vq-violet)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10 }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => fmtTokens(v)}
            />
            <Tooltip
              formatter={(v) => [typeof v === "number" ? fmt(v) : v, "tokens"]}
              labelFormatter={(l) => `Week of ${l as string}`}
            />
            <Area
              type="monotone"
              dataKey="tokens"
              stroke="var(--vq-violet)"
              strokeWidth={2}
              fill="url(#tokenGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* By Agent + By Model side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* By Agent */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 text-sm font-semibold">Breakdown by Agent (30d)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {["Agent", "Messages", "Tokens", "Est. Cost", "Share"].map((h) => (
                  <th
                    key={h}
                    className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {byAgent.map((row) => (
                <tr key={row.agent}>
                  <td className="py-2 font-medium">{row.agent}</td>
                  <td className="py-2 font-mono">{fmt(row.messages)}</td>
                  <td className="py-2 font-mono">{fmtTokens(row.tokens)}</td>
                  <td className="py-2 font-mono">{fmtCost(row.estimatedCost)}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${row.pctShare}%`,
                          minWidth: row.pctShare > 0 ? 4 : 0,
                          backgroundColor: "var(--vq-violet)",
                        }}
                      />
                      <span className="font-mono text-xs">{row.pctShare}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* By Model */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 text-sm font-semibold">Breakdown by Model (30d)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {["Model", "Messages", "Tokens", "Est. Cost"].map((h) => (
                  <th
                    key={h}
                    className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {byModel.map((row) => (
                <tr key={row.model}>
                  <td className="py-2 font-mono text-xs">{row.model}</td>
                  <td className="py-2 font-mono">{fmt(row.messages)}</td>
                  <td className="py-2 font-mono">{fmtTokens(row.tokens)}</td>
                  <td className="py-2 font-mono">{fmtCost(row.estimatedCost)}</td>
                </tr>
              ))}
              {byModel.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[var(--muted-foreground)]">
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Customers */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-1 text-sm font-semibold">Top Customers by Usage (30d)</h2>
        <p className="mb-4 text-xs text-[var(--muted-foreground)]">
          Yellow = trialing · Red = est. cost exceeds monthly revenue
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {["Org", "Status", "Plan", "Messages", "Tokens", "Est. Cost", "Cost / Rev"].map(
                  (h) => (
                    <th
                      key={h}
                      className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {topOrgs.map((org) => {
                const isTrial = org.subscriptionStatus === "TRIALING";
                const isOverCost =
                  org.costRevenueRatio !== null && org.costRevenueRatio > 1;
                return (
                  <tr
                    key={org.orgId}
                    style={{
                      backgroundColor: isOverCost
                        ? "rgba(240,100,100,0.12)"
                        : isTrial
                          ? "rgba(245,197,24,0.12)"
                          : undefined,
                    }}
                  >
                    <td className="py-2">
                      <Link
                        href={`/organizations/${org.orgId}`}
                        className="font-medium hover:underline"
                      >
                        {org.orgName}
                      </Link>
                    </td>
                    <td className="py-2 text-xs text-[var(--muted-foreground)]">
                      {org.subscriptionStatus ?? "—"}
                    </td>
                    <td className="py-2 text-xs text-[var(--muted-foreground)]">
                      {org.plan ?? "—"}
                    </td>
                    <td className="py-2 font-mono">{fmt(org.messages)}</td>
                    <td className="py-2 font-mono">{fmtTokens(org.tokens)}</td>
                    <td className="py-2 font-mono">{fmtCost(org.estimatedCost)}</td>
                    <td
                      className={cn(
                        "py-2 font-mono",
                        isOverCost && "font-bold text-[var(--vq-red)]",
                      )}
                    >
                      {org.costRevenueRatio !== null
                        ? `${(org.costRevenueRatio * 100).toFixed(0)}%`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {topOrgs.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-[var(--muted-foreground)]"
                  >
                    No usage data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trial vs Paid comparison */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold">Trial vs Paid — Average Usage (30d)</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--vq-yellow)] opacity-80">
              Trialing ({trialVsPaid.trial.orgCount} orgs)
            </p>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Avg tokens / org</p>
              <p className="font-mono text-2xl font-bold">
                {fmtTokens(trialVsPaid.trial.avgTokens)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Avg est. cost / org</p>
              <p className="font-mono text-2xl font-bold">
                {fmtCost(trialVsPaid.trial.avgCost)}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--vq-green)] opacity-80">
              Active ({trialVsPaid.paid.orgCount} orgs)
            </p>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Avg tokens / org</p>
              <p className="font-mono text-2xl font-bold">
                {fmtTokens(trialVsPaid.paid.avgTokens)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Avg est. cost / org</p>
              <p className="font-mono text-2xl font-bold">
                {fmtCost(trialVsPaid.paid.avgCost)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
