"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { SettleUpSheet } from "./SettleUpSheet";
import type { BalanceResult, ExpenseGroup } from "./types";

function fmt(n: number, currency: string) {
  return `${currency} ${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BalancesPanel({ groupId, group }: { groupId: string; group: ExpenseGroup }) {
  const [settleData, setSettleData] = useState<{ from: string; to: string; amount: number } | null>(null);


  const { data, isLoading } = useQuery<BalanceResult>({
    queryKey: ["expenses", "balances", groupId],
    queryFn: () => apiFetch(`/expenses/groups/${groupId}/balances`),
  });

  const memberMap = Object.fromEntries(group.members.map((m) => [m.id, m]));

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-lg bg-[var(--muted)]" />;
  }

  const currency = data?.currency ?? "USD";
  const balances = data?.balances ?? [];
  const transfers = data?.transfers ?? [];

  return (
    <div className="space-y-6">
      {/* Net balances */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Net Balances</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map((b) => {
            const member = memberMap[b.memberId];
            const isOwed = b.net > 0;
            return (
              <div
                key={b.memberId}
                className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-xs font-bold uppercase">
                  {member?.name.slice(0, 2) ?? "??"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member?.name ?? b.memberId}</p>
                  <p className={`text-xs font-semibold ${isOwed ? "text-green-600" : b.net < 0 ? "text-red-500" : "text-[var(--muted-foreground)]"}`}>
                    {b.net === 0 ? "Settled up" : isOwed ? `is owed ${fmt(b.net, currency)}` : `owes ${fmt(b.net, currency)}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Simplified transfers */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Suggested Settlements</h3>
        {transfers.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Everyone is settled up!
          </div>
        ) : (
          <div className="space-y-2">
            {transfers.map((t, i) => {
              const from = memberMap[t.fromMemberId];
              const to = memberMap[t.toMemberId];
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                  <span className="text-sm font-medium">{from?.name ?? t.fromMemberId}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                  <span className="text-sm font-medium">{to?.name ?? t.toMemberId}</span>
                  <span className="ml-auto font-mono text-sm font-semibold">{fmt(t.amount, currency)}</span>
                  <button
                    onClick={() => setSettleData({ from: t.fromMemberId, to: t.toMemberId, amount: t.amount })}
                    className="rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium hover:bg-[var(--muted)]"
                  >
                    Settle
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {settleData && (
        <SettleUpSheet
          open
          onClose={() => setSettleData(null)}
          group={group}
          presetFrom={settleData.from}
          presetTo={settleData.to}
          presetAmount={settleData.amount}
        />
      )}
    </div>
  );
}
