"use client";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AttentionItem = {
  id: string;
  name: string;
  subscriptionStatus: string | null;
  plan: string | null;
  urgencyReason: string;
  urgencyScore: number; // 1-4
  action: "extend-trial" | "view";
  entitlementExpiresAt: string | null;
};

function urgencyBadgeClass(score: number): string {
  if (score >= 4) return "bg-red-100 text-red-800";
  if (score === 3) return "bg-orange-100 text-orange-800";
  if (score === 2) return "bg-yellow-100 text-yellow-800";
  return "bg-purple-100 text-purple-700";
}

function urgencyRowClass(score: number): string {
  if (score >= 4) return "bg-red-50";
  if (score === 3) return "bg-orange-50";
  if (score === 2) return "bg-yellow-50";
  return "";
}

function urgencyLabel(score: number): string {
  if (score >= 4) return "Critical";
  if (score === 3) return "High";
  if (score === 2) return "Medium";
  return "Low";
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

export function AttentionList({ items }: { items: AttentionItem[] }) {
  const displayed = items.slice(0, 20);

  if (displayed.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        No orgs need immediate attention.
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
              Status
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Urgency
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="bg-[var(--card)]">
          {displayed.map((item) => (
            <tr
              key={item.id}
              className={cn(
                "border-b border-[var(--border)] last:border-0",
                urgencyRowClass(item.urgencyScore),
              )}
            >
              <td className="px-4 py-3">
                <Link
                  href={`/organizations/${item.id}`}
                  className="font-medium hover:underline"
                >
                  {item.name}
                </Link>
                {item.plan && (
                  <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                    {item.plan}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-[var(--muted-foreground)]">
                  {item.subscriptionStatus ?? "—"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    urgencyBadgeClass(item.urgencyScore),
                  )}
                >
                  {urgencyLabel(item.urgencyScore)}
                </span>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {item.urgencyReason}
                </p>
              </td>
              <td className="px-4 py-3">
                {item.action === "extend-trial" ? (
                  <ExtendButton orgId={item.id} />
                ) : (
                  <Link
                    href={`/organizations/${item.id}`}
                    className="rounded border border-[var(--border)] bg-white px-3 py-1 text-xs hover:bg-[var(--muted)]"
                  >
                    View
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
