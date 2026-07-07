"use client";
import Link from "next/link";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

type ChurnRiskOrg = {
  id: string;
  name: string;
  subscriptionStatus: string | null;
  plan: string | null;
  lastActive: string | null;
  riskReason: string;
  healthScore: number;
  healthLabel: string;
};

function HealthBadge({ label }: { label: string }) {
  const colorClass =
    label === "Healthy"
      ? "bg-green-100 text-green-800"
      : label === "Watch"
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colorClass,
      )}
    >
      {label}
    </span>
  );
}

function ExtendButton({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(false);

  const handleExtend = async () => {
    setLoading(true);
    try {
      await apiFetch(`/admin/organizations/${orgId}/extend-trial`, {
        method: "PATCH",
      });
      toast.success("Trial extended by 7 days");
    } catch {
      toast.error("Failed to extend trial");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExtend}
      disabled={loading}
      className="rounded border border-[var(--border)] bg-white px-3 py-1 text-xs hover:bg-[var(--muted)] disabled:opacity-50"
    >
      {loading ? "Extending…" : "Extend Trial"}
    </button>
  );
}

export function ChurnRiskTable({ orgs }: { orgs: ChurnRiskOrg[] }) {
  if (orgs.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        No churn risks detected.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Org
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Plan
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Status
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Last Active
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Risk Reason
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Health
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-[var(--card)]">
          {orgs.map((org) => (
            <tr
              key={org.id}
              className="border-b border-[var(--border)] last:border-0"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/organizations/${org.id}`}
                  className="font-medium hover:underline"
                >
                  {org.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                {org.plan ?? "—"}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={org.subscriptionStatus} />
              </td>
              <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                {org.lastActive
                  ? format(new Date(org.lastActive), "MMM d, yyyy")
                  : "—"}
              </td>
              <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                {org.riskReason}
              </td>
              <td className="px-4 py-3">
                <HealthBadge label={org.healthLabel} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {org.subscriptionStatus === "TRIALING" && (
                    <ExtendButton orgId={org.id} />
                  )}
                  <Link
                    href={`/organizations/${org.id}`}
                    className="rounded border border-[var(--border)] bg-white px-3 py-1 text-xs hover:bg-[var(--muted)]"
                  >
                    View
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
