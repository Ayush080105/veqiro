"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Download, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AddExpenseSheet } from "./AddExpenseSheet";
import { CATEGORIES, CATEGORY_COLORS } from "./types";
import type { Expense, ExpenseGroup } from "./types";

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
      style={{ background: CATEGORY_COLORS[category] ?? "#95A5A6" }}
    >
      {category}
    </span>
  );
}

export function ExpenseList({ groupId, group }: { groupId: string; group: ExpenseGroup }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | undefined>();
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPaidBy, setFilterPaidBy] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(filterCategory ? { category: filterCategory } : {}),
    ...(filterPaidBy ? { paidByMemberId: filterPaidBy } : {}),
  });

  const { data, isLoading } = useQuery<{ items: Expense[]; total: number; page: number; limit: number }>({
    queryKey: ["expenses", "expenses", groupId, filterCategory, filterPaidBy, page],
    queryFn: () => apiFetch(`/expenses/groups/${groupId}/expenses?${params}`),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/expenses/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", "expenses", groupId] });
      qc.invalidateQueries({ queryKey: ["expenses", "balances", groupId] });
      qc.invalidateQueries({ queryKey: ["expenses", "stats", groupId] });
      qc.invalidateQueries({ queryKey: ["expenses", "activity", groupId] });
    },
  });

  const handleExport = async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:5000"}/api/${process.env.NEXT_PUBLIC_API_VERSION ?? "v1"}/expenses/groups/${groupId}/export?format=csv`,
      { credentials: "include" },
    );
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `expenses-${groupId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
        >
          <Plus className="h-4 w-4" /> Add Expense
        </button>

        {/* Category filter */}
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Paid-by filter */}
        <select
          value={filterPaidBy}
          onChange={(e) => { setFilterPaidBy(e.target.value); setPage(1); }}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          <option value="">All payers</option>
          {group.members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <button onClick={handleExport} className="ml-auto flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)] text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Paid by</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">USD</th>
              <th className="px-4 py-3 text-center">Recurring</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {isLoading ? (
              <tr><td colSpan={8} className="py-8 text-center text-[var(--muted-foreground)]">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-[var(--muted-foreground)]">No expenses yet</td></tr>
            ) : items.map((e) => (
              <tr key={e.id} className="bg-[var(--card)] transition-colors hover:bg-[var(--muted)]">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--muted-foreground)]">
                  {new Date(e.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{e.title}</div>
                  {e.notes && <div className="text-xs text-[var(--muted-foreground)] truncate max-w-[200px]">{e.notes}</div>}
                  {e.receiptUrl && (
                    <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">receipt</a>
                  )}
                </td>
                <td className="px-4 py-3"><CategoryBadge category={e.category} /></td>
                <td className="px-4 py-3 text-sm">{e.paidByMember.name}</td>
                <td className="px-4 py-3 text-right font-mono text-sm">{e.amount.toFixed(2)} {e.currency}</td>
                <td className="px-4 py-3 text-right font-mono text-sm text-[var(--muted-foreground)]">${e.amountUsd.toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  {e.isRecurring && <span title={e.cronExpression ?? ""}><RefreshCw className="mx-auto h-3.5 w-3.5 text-[var(--muted-foreground)]" /></span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditExpense(e)} className="rounded p-1 hover:bg-[var(--muted)]">
                      <Pencil className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    </button>
                    <button
                      onClick={() => { if (confirm("Delete this expense?")) del.mutate(e.id); }}
                      className="rounded p-1 hover:bg-[var(--muted)]"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
          <span>{total} total</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded p-1 disabled:opacity-40 hover:bg-[var(--muted)]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="rounded p-1 disabled:opacity-40 hover:bg-[var(--muted)]">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <AddExpenseSheet open={addOpen} onClose={() => setAddOpen(false)} group={group} />
      {editExpense && (
        <AddExpenseSheet open onClose={() => setEditExpense(undefined)} group={group} expense={editExpense} />
      )}
    </div>
  );
}
