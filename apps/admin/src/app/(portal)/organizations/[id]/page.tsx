import { requireAdminSession } from "@/lib/server-session";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { ExtendTrialButton } from "@/components/orgs/ExtendTrialButton";

type Member = {
  role: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
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
};

function fmt(d: string | null) {
  return d ? format(new Date(d), "MMM d, yyyy") : "—";
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
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
      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
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
              <ExtendTrialButton orgId={org.id} />
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">No subscription record.</p>
        )}
      </section>

      {/* Members */}
      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
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
      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
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

      {/* Integrations */}
      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
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
    </div>
  );
}
