"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart2, List, Scale, Clock, Bot } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ExpenseList } from "./ExpenseList";
import { BalancesPanel } from "./BalancesPanel";
import { ActivityFeed } from "./ActivityFeed";
import { OverviewTab } from "./OverviewTab";
import { RexInsightsPanel } from "./RexInsightsPanel";
import type { ExpenseGroup } from "./types";

const TABS = [
  { id: "overview", label: "Overview", Icon: BarChart2 },
  { id: "expenses", label: "Expenses", Icon: List },
  { id: "balances", label: "Balances", Icon: Scale },
  { id: "activity", label: "Activity", Icon: Clock },
  { id: "rex", label: "Ask Rex", Icon: Bot },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function GroupDetailClient({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: group, isLoading } = useQuery<ExpenseGroup>({
    queryKey: ["expenses", "group", groupId],
    queryFn: () => apiFetch(`/expenses/groups/${groupId}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />
      </div>
    );
  }

  if (!group) {
    return <p className="text-sm text-[var(--muted-foreground)]">Group not found.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/expenses")}
          className="rounded p-1.5 hover:bg-[var(--muted)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{group.name}</h1>
          {group.description && (
            <p className="text-sm text-[var(--muted-foreground)]">{group.description}</p>
          )}
        </div>
        <span className="ml-auto rounded-full bg-[var(--muted)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
          {group.currency}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? "border-[var(--primary)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab groupId={groupId} />}
      {tab === "expenses" && <ExpenseList groupId={groupId} group={group} />}
      {tab === "balances" && <BalancesPanel groupId={groupId} group={group} />}
      {tab === "activity" && <ActivityFeed groupId={groupId} group={group} />}
      {tab === "rex" && <RexInsightsPanel groupId={groupId} />}
    </div>
  );
}
