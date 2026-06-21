"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus, Users, Receipt, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { CreateGroupSheet } from "./CreateGroupSheet";
import type { ExpenseGroup } from "./types";

function GroupCard({ group, onClick }: { group: ExpenseGroup; onClick: () => void }) {
  const totalExpenses = group._count?.expenses ?? 0;
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 text-left transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{group.name}</p>
          {group.description && (
            <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">{group.description}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-[var(--muted)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
          {group.currency}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {group.members.length} member{group.members.length !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <Receipt className="h-3.5 w-3.5" />
          {totalExpenses} expense{totalExpenses !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-3 flex -space-x-1.5">
        {group.members.slice(0, 5).map((m) => (
          <div
            key={m.id}
            title={m.name}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--card)] bg-[var(--muted)] text-[8px] font-bold uppercase text-[var(--muted-foreground)]"
          >
            {m.name.slice(0, 2)}
          </div>
        ))}
        {group.members.length > 5 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--card)] bg-[var(--muted)] text-[8px] text-[var(--muted-foreground)]">
            +{group.members.length - 5}
          </div>
        )}
      </div>
    </button>
  );
}

export function GroupsClient() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: groups = [], isLoading } = useQuery<ExpenseGroup[]>({
    queryKey: ["expenses", "groups"],
    queryFn: () => apiFetch("/expenses/groups"),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Expenses</h1>
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
            Team expense tracking &amp; splitting
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Group
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-[var(--muted)]" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] py-20 text-center">
          <TrendingUp className="mb-3 h-8 w-8 text-[var(--muted-foreground)]" />
          <p className="text-sm font-medium">No expense groups yet</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Create a group to start tracking shared expenses
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          >
            <Plus className="h-4 w-4" /> Create your first group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} onClick={() => router.push(`/expenses/${g.id}`)} />
          ))}
        </div>
      )}

      <CreateGroupSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
