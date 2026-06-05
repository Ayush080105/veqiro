import { requireAdminSession } from "@/lib/server-session";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { TrialManagementButton } from "@/components/orgs/TrialManagementButton";
import { OrgTokenChart } from "@/components/orgs/OrgTokenChart";
import { cn } from "@/lib/utils";

type Member = {
  role: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
};

type TokenUsage = {
  totalAllTime: number;
  total30d: number;
  estimatedCost30d: number;
  messages30d: number;
  byAgent: Array<{
    agent: string;
    messages: number;
    tokens: number;
    estimatedCost: number;
  }>;
  weeklyTrend: Array<{ week: string; tokens: number; messages: number }>;
};

type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  onboarded: boolean;
  createdAt: string;
  subscriptionStatus: string | null;
  entitlementExpiresAt: string | null;
  subscription: {
    plan: string | null;
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    dodoCustomerId: string;
    dodoSubscriptionId: string | null;
  } | null;
  members: Member[];
  agentActivity: Array<{ agent: string; messages: number }>;
  connectedPlatforms: string[];
  tokenUsage: TokenUsage;
  vegaFollowUps: Array<{
    id: string;
    emailSubject: string;
    senderEmail: string;
    dueAt: string;
    draftText: string;
    status: string; // "PENDING" | "OVERDUE" | "SENT" | "CANCELLED"
    createdAt: string;
  }>;
  contentStats: {
    ideasTotal: number;
    ideasPublished: number;
    publishedPosts: number;
    failedPosts: number;
    pendingPosts: number;
    postsByPlatform: Array<{ platform: string; count: number }>;
  } | null;
  recentFailedPosts: Array<{
    id: string;
    platform: string;
    error: string | null;
    createdAt: string;
  }>;
};

function fmt(d: string | null) {
  return d ? format(new Date(d), "MMM d, yyyy") : "—";
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function TokenStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;

  const hdrs = await headers();
  const res = await fetch(
    `${process.env.BACKEND_URL}/api/v1/admin/organizations/${id}`,
    {
      headers: {
        cookie: hdrs.get("cookie") ?? "",
        "user-agent": hdrs.get("user-agent") ?? "",
      },
      cache: "no-store",
    },
  );
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error("Failed to fetch org");
  const org: OrgDetail = await res.json();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/organizations"
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold">{org.name}</h1>
        <StatusBadge status={org.subscriptionStatus} />
        <span className="text-sm text-[var(--muted-foreground)]">/{org.slug}</span>
        <span className="text-xs text-[var(--muted-foreground)]">
          Created {fmt(org.createdAt)}
        </span>
      </div>

      {/* Subscription */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold">Subscription</h2>
        {org.subscription ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Detail label="Status" value={<StatusBadge status={org.subscriptionStatus} />} />
              <Detail label="Plan" value={org.subscription.plan ?? "—"} />
              <Detail label="Trial ends" value={fmt(org.subscription.trialEndsAt)} />
              <Detail label="Period end" value={fmt(org.subscription.currentPeriodEnd)} />
              <Detail
                label="Entitlement expires"
                value={fmt(org.entitlementExpiresAt)}
              />
              <Detail
                label="Cancel at period end"
                value={org.subscription.cancelAtPeriodEnd ? "Yes" : "No"}
              />
              <Detail
                label="Dodo Customer ID"
                value={
                  <code className="text-xs font-mono">
                    {org.subscription.dodoCustomerId}
                  </code>
                }
              />
              <Detail
                label="Dodo Subscription ID"
                value={
                  <code className="text-xs font-mono">
                    {org.subscription.dodoSubscriptionId ?? "—"}
                  </code>
                }
              />
            </div>
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <TrialManagementButton orgId={org.id} currentStatus={org.subscriptionStatus} />
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">No subscription record.</p>
        )}
      </section>

      {/* Members */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold">Members ({org.members.length})</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["Name", "Email", "Role", "Joined"].map((h) => (
                <th key={h} className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {org.members.map((m) => (
              <tr key={m.user.id}>
                <td className="py-2 font-medium">{m.user.name}</td>
                <td className="py-2 text-[var(--muted-foreground)]">{m.user.email}</td>
                <td className="py-2 capitalize">{m.role}</td>
                <td className="py-2 text-[var(--muted-foreground)]">{fmt(m.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Agent Activity */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold">Agent Activity (last 30 days)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Agent</th>
              <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Messages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {org.agentActivity.map((a) => (
              <tr key={a.agent}>
                <td className="py-2 capitalize">{a.agent.toLowerCase()}</td>
                <td className="py-2 text-right font-mono">{a.messages}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Vega Tasks */}
      {org.vegaFollowUps?.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 text-sm font-semibold">Vega Tasks</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {["Email Subject", "Due At", "Status", "Preview"].map((h) => (
                  <th key={h} className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {org.vegaFollowUps.map((f) => (
                <tr key={f.id}>
                  <td className="py-2 font-medium">{f.emailSubject}</td>
                  <td className="py-2 text-[var(--muted-foreground)]">{fmt(f.dueAt)}</td>
                  <td className="py-2">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      f.status === "OVERDUE" ? "bg-red-100 text-red-800" :
                      f.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                      f.status === "SENT" ? "bg-green-100 text-green-800" :
                      "bg-gray-100 text-gray-800"
                    )}>{f.status}</span>
                  </td>
                  <td className="py-2 text-xs text-[var(--muted-foreground)]">
                    {f.draftText.slice(0, 80)}{f.draftText.length > 80 ? "…" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Content */}
      {org.contentStats && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 text-sm font-semibold">Content</h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 mb-4">
            <TokenStat label="Ideas Generated" value={String(org.contentStats.ideasTotal)} />
            <TokenStat label="Ideas Published" value={String(org.contentStats.ideasPublished)} />
            <TokenStat label="Publish Rate" value={org.contentStats.ideasTotal > 0 ? `${Math.round((org.contentStats.ideasPublished / org.contentStats.ideasTotal) * 100)}%` : "—"} />
            <TokenStat label="Posts Published" value={String(org.contentStats.publishedPosts)} />
            <TokenStat label="Posts Failed" value={String(org.contentStats.failedPosts)} />
          </div>
          {org.contentStats.postsByPlatform.length > 0 && (
            <div className="flex gap-3">
              {org.contentStats.postsByPlatform.map((p) => (
                <span key={p.platform} className="rounded border border-[var(--border)] px-3 py-1 text-sm">
                  {p.platform}: {p.count}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Recent Failed Posts */}
      {org.recentFailedPosts?.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 text-sm font-semibold">Recent Failed Posts (7 days)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {["Platform", "Error", "Created"].map((h) => (
                  <th key={h} className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {org.recentFailedPosts.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 capitalize">{p.platform.toLowerCase()}</td>
                  <td className="py-2 text-[var(--muted-foreground)] text-xs">{p.error ?? "Unknown error"}</td>
                  <td className="py-2 text-[var(--muted-foreground)]">{fmt(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Integrations */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold">Connected Integrations</h2>
        {org.connectedPlatforms.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">None connected.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {org.connectedPlatforms.map((p) => (
              <span
                key={p}
                className="rounded border border-[var(--border)] px-3 py-1 text-sm capitalize"
              >
                {p.toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* LLM Usage */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold">LLM Usage</h2>

        {/* Summary stats row */}
        <div className="mb-5 grid grid-cols-2 gap-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 sm:grid-cols-4">
          <TokenStat label="All-time tokens" value={fmtTokens(org.tokenUsage.totalAllTime)} />
          <TokenStat label="Tokens (30d)" value={fmtTokens(org.tokenUsage.total30d)} />
          <TokenStat label="Est. cost (30d)" value={`$${org.tokenUsage.estimatedCost30d.toFixed(2)}`} />
          <TokenStat label="Messages (30d)" value={org.tokenUsage.messages30d.toLocaleString()} />
        </div>

        {/* 8-week trend chart */}
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Token trend (8 weeks)
          </p>
          <OrgTokenChart data={org.tokenUsage.weeklyTrend} />
        </div>

        {/* Per-agent breakdown */}
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          By agent (30d)
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["Agent", "Messages", "Tokens", "Est. Cost"].map((h) => (
                <th key={h} className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {org.tokenUsage.byAgent.map((row) => (
              <tr key={row.agent}>
                <td className="py-2 capitalize">{row.agent}</td>
                <td className="py-2 font-mono">{row.messages.toLocaleString()}</td>
                <td className="py-2 font-mono">{fmtTokens(row.tokens)}</td>
                <td className="py-2 font-mono">${row.estimatedCost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
