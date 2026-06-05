"use client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type AgentsData = {
  agentAdoption: Array<{
    agent: string;
    orgCount: number;
    pctActiveOrgs: number;
  }>;
  agentDepth: Array<{
    agent: string;
    orgsUsingIt: number;
    pctActiveOrgs: number;
    totalMessages30d: number;
    avgMessagesPerOrg: number;
    totalTokens30d: number;
    pctPlatformTokens: number;
  }>;
  agentSpecific: {
    maya: {
      ideasGenerated30d: number;
      ideasPublished30d: number;
      conversionPct: number;
      postsByStatus: Array<{ status: string; count: number }>;
    };
    sage: {
      totalKeywords: number;
      avgKeywordsPerOrg: number;
      difficultyDistribution: { easy: number; medium: number; hard: number };
    };
    lex: {
      totalSources: number;
      avgPageCount: number;
      avgChunksCreated: number;
    };
    rex: {
      totalDatasets: number;
      datasetsWithApiKey: number;
      weeklyDigestOrgs: number;
      totalPinnedCards: number;
    };
    scout: {
      totalCompetitors: number;
      avgCompetitorsPerOrg: number;
      totalSourceUploads: number;
    };
    vega: {
      totalFollowUps: number;
      sentFollowUps: number;
      completionPct: number;
      overdueFollowUps: number;
      totalVIPContacts: number;
      avgVIPPerOrg: number;
      totalBriefings: number;
    };
  };
};

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

export function AgentsClient() {
  const { data, isLoading, error } = useQuery<AgentsData>({
    queryKey: ["admin", "agents"],
    queryFn: () => apiFetch<AgentsData>("/admin/agents"),
  });

  if (isLoading)
    return <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>;
  if (error || !data)
    return <p className="text-sm text-red-500">Failed to load agents data.</p>;

  const { agentAdoption, agentDepth, agentSpecific } = data;

  const sortedDepth = [...agentDepth].sort(
    (a, b) => b.totalMessages30d - a.totalMessages30d,
  );

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Agents</h1>

      {/* Section 1: Agent Adoption */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold">Agent Adoption (Platform-wide)</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {agentAdoption.map((agent) => (
            <div
              key={agent.agent}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <p className="text-xs font-medium uppercase text-[var(--muted-foreground)]">
                {agent.agent}
              </p>
              <p className="mt-1 font-mono text-2xl font-bold">{agent.pctActiveOrgs}%</p>
              <p className="text-xs text-[var(--muted-foreground)]">{agent.orgCount} orgs</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Agent Usage Depth */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold">Agent Usage Depth (last 30 days)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {[
                  "Agent",
                  "Orgs Using",
                  "Total Messages",
                  "Avg Msgs/Org",
                  "Total Tokens",
                  "% Platform Tokens",
                ].map((h) => (
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
              {sortedDepth.map((row) => (
                <tr key={row.agent}>
                  <td className="py-2 font-medium">{row.agent}</td>
                  <td className="py-2 font-mono">{row.orgsUsingIt}</td>
                  <td className="py-2 font-mono">{row.totalMessages30d.toLocaleString()}</td>
                  <td className="py-2 font-mono">{row.avgMessagesPerOrg.toLocaleString()}</td>
                  <td className="py-2 font-mono">{fmtTokens(row.totalTokens30d)}</td>
                  <td className="py-2 font-mono">{row.pctPlatformTokens}%</td>
                </tr>
              ))}
              {sortedDepth.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-6 text-center text-[var(--muted-foreground)]"
                  >
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: Agent-Specific Metrics */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold">Agent-Specific Metrics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Maya */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Maya
            </p>
            <MetricRow
              label="Ideas Generated (30d)"
              value={agentSpecific.maya.ideasGenerated30d.toLocaleString()}
            />
            <MetricRow
              label="Ideas Published (30d)"
              value={agentSpecific.maya.ideasPublished30d.toLocaleString()}
            />
            <MetricRow
              label="Conversion"
              value={`${agentSpecific.maya.conversionPct}%`}
            />
            {agentSpecific.maya.postsByStatus
              .filter((s) => s.count > 0)
              .map((s) => (
                <MetricRow
                  key={s.status}
                  label={s.status}
                  value={s.count.toLocaleString()}
                />
              ))}
          </div>

          {/* Sage */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Sage
            </p>
            <MetricRow
              label="Total Keywords"
              value={agentSpecific.sage.totalKeywords.toLocaleString()}
            />
            <MetricRow
              label="Avg per Org"
              value={agentSpecific.sage.avgKeywordsPerOrg.toLocaleString()}
            />
            <MetricRow
              label="Difficulty"
              value={`Easy ${agentSpecific.sage.difficultyDistribution.easy} / Medium ${agentSpecific.sage.difficultyDistribution.medium} / Hard ${agentSpecific.sage.difficultyDistribution.hard}`}
            />
          </div>

          {/* Lex */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Lex
            </p>
            <MetricRow
              label="Total Sources"
              value={agentSpecific.lex.totalSources.toLocaleString()}
            />
            <MetricRow
              label="Avg Page Count"
              value={agentSpecific.lex.avgPageCount.toLocaleString()}
            />
            <MetricRow
              label="Avg Chunks"
              value={agentSpecific.lex.avgChunksCreated.toLocaleString()}
            />
          </div>

          {/* Rex */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Rex
            </p>
            <MetricRow
              label="Datasets"
              value={agentSpecific.rex.totalDatasets.toLocaleString()}
            />
            <MetricRow
              label="With API Key"
              value={agentSpecific.rex.datasetsWithApiKey.toLocaleString()}
            />
            <MetricRow
              label="Pinned Cards"
              value={agentSpecific.rex.totalPinnedCards.toLocaleString()}
            />
          </div>

          {/* Scout */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Scout
            </p>
            <MetricRow
              label="Competitors Tracked"
              value={agentSpecific.scout.totalCompetitors.toLocaleString()}
            />
            <MetricRow
              label="Avg per Org"
              value={agentSpecific.scout.avgCompetitorsPerOrg.toLocaleString()}
            />
            <MetricRow
              label="Source Uploads"
              value={agentSpecific.scout.totalSourceUploads.toLocaleString()}
            />
          </div>

          {/* Vega */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Vega
            </p>
            <MetricRow
              label="Follow-ups Total"
              value={agentSpecific.vega.totalFollowUps.toLocaleString()}
            />
            <MetricRow
              label="Completed"
              value={`${agentSpecific.vega.sentFollowUps.toLocaleString()} (${agentSpecific.vega.completionPct}%)`}
            />
            <MetricRow
              label="Overdue"
              value={agentSpecific.vega.overdueFollowUps.toLocaleString()}
            />
            <MetricRow
              label="VIP Contacts"
              value={agentSpecific.vega.totalVIPContacts.toLocaleString()}
            />
          </div>

        </div>
      </section>
    </div>
  );
}
