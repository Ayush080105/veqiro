"use client";
import { useQuery } from "@tanstack/react-query";
import { Receipt, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { CATEGORY_COLORS } from "./types";
import type { ActivityItem } from "./types";

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString();
}

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ActivityFeed({ groupId }: { groupId: string; group?: unknown }) {
  const { data, isLoading } = useQuery<ActivityItem[]>({
    queryKey: ["expenses", "activity", groupId],
    queryFn: () => apiFetch(`/expenses/groups/${groupId}/activity`),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-[var(--muted)]" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">
        No activity yet — add an expense to get started.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        if (item.type === "expense") {
          const e = item.data;
          const splitSummary = e.splits.length > 0
            ? `split ${e.splits.length} ways`
            : "no split recorded";
          return (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
              <div
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ background: CATEGORY_COLORS[e.category] ?? "#95A5A6" }}
              >
                <Receipt className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {e.paidByMember.name} paid <span className="font-mono font-semibold">{fmt(e.amount, e.currency)}</span>
                  {" · "}{splitSummary}{" · "}{e.category.toLowerCase()}
                </p>
              </div>
              <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{timeAgo(item.ts)}</span>
            </div>
          );
        }

        const s = item.data;
        return (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
              <ArrowRight className="h-4 w-4 text-green-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{s.fromMember.name}</span>
                {" paid "}
                <span className="font-medium">{s.toMember.name}</span>
                {" "}
                <span className="font-mono font-semibold">{fmt(s.amount, s.currency)}</span>
                {s.method && <span className="text-[var(--muted-foreground)]"> via {s.method}</span>}
              </p>
              {s.notes && <p className="text-xs text-[var(--muted-foreground)] truncate">{s.notes}</p>}
            </div>
            <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{timeAgo(item.ts)}</span>
          </div>
        );
      })}
    </div>
  );
}
