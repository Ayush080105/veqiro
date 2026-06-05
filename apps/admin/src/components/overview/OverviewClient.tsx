"use client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { SignupsChart } from "@/components/charts/SignupsChart";
import { HealthChart } from "@/components/charts/HealthChart";
import { AgentChart } from "@/components/charts/AgentChart";

type OverviewData = {
  stats: {
    totalOrgs: number;
    activeSubscriptions: number;
    trialing: number;
    trialExpiringSoon: number;
    pastDue: number;
    cancelledOrExpired: number;
    newOrgsThisWeek: number;
    totalUsers: number;
    totalTokens30d: number;
    estimatedCost30d: number;
    activeOrgs30d: number;
  };
  charts: {
    signupsPerWeek: Array<{ week: string; count: number }>;
    healthPerWeek: Array<{
      week: string;
      active: number;
      trialing: number;
      pastDue: number;
      cancelledExpired: number;
    }>;
    agentPopularity: Array<{ agent: string; messages: number }>;
  };
};

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function UsageMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function OverviewClient() {
  const { data, isLoading, error } = useQuery<OverviewData>({
    queryKey: ["admin", "overview"],
    queryFn: () => apiFetch<OverviewData>("/admin/overview"),
  });

  if (isLoading)
    return <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>;
  if (error || !data)
    return <p className="text-sm text-red-500">Failed to load overview.</p>;

  const { stats, charts } = data;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Overview</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Orgs" value={stats.totalOrgs} />
        <StatCard label="Active" value={stats.activeSubscriptions} />
        <StatCard label="Trialing" value={stats.trialing} />
        <StatCard label="New This Week" value={stats.newOrgsThisWeek} />
        <StatCard
          label="Trials Expiring (7d)"
          value={stats.trialExpiringSoon}
          highlight={stats.trialExpiringSoon > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Past-Due"
          value={stats.pastDue}
          highlight={stats.pastDue > 0 ? "danger" : undefined}
        />
        <StatCard label="Cancelled / Expired" value={stats.cancelledOrExpired} />
        <StatCard label="Total Users" value={stats.totalUsers} />
        <StatCard label="Active Orgs (30d)" value={stats.activeOrgs30d} />
        <UsageMiniCard label="Tokens (30d)" value={fmtTokens(stats.totalTokens30d)} />
        <UsageMiniCard
          label="Est. LLM Cost (30d)"
          value={`$${stats.estimatedCost30d.toFixed(2)}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SignupsChart data={charts.signupsPerWeek} />
        <HealthChart data={charts.healthPerWeek} />
        <AgentChart data={charts.agentPopularity} />
      </div>
    </div>
  );
}
