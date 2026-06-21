"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ExpenseGroup } from "./types";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "SGD", "AUD", "CAD", "JPY", "AED"];
const METHODS = ["UPI", "Cash", "Bank Transfer", "Card", "Other"];

export function SettleUpSheet({
  open,
  onClose,
  group,
  presetFrom,
  presetTo,
  presetAmount,
}: {
  open: boolean;
  onClose: () => void;
  group: ExpenseGroup;
  presetFrom?: string;
  presetTo?: string;
  presetAmount?: number;
}) {
  const qc = useQueryClient();
  const [fromMemberId, setFromMemberId] = useState(presetFrom ?? "");
  const [toMemberId, setToMemberId] = useState(presetTo ?? "");
  const [amount, setAmount] = useState(presetAmount ? String(presetAmount.toFixed(2)) : "");
  const [currency, setCurrency] = useState(group.currency);
  const [method, setMethod] = useState("UPI");
  const [notes, setNotes] = useState("");
  const [settledAt, setSettledAt] = useState(new Date().toISOString().slice(0, 10));

  const save = useMutation({
    mutationFn: (body: object) =>
      apiFetch(`/expenses/groups/${group.id}/settle`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", "balances", group.id] });
      qc.invalidateQueries({ queryKey: ["expenses", "activity", group.id] });
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="flex h-full w-full max-w-sm flex-col bg-[var(--card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold">Settle Up</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--muted)]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-5 p-6">
          <div>
            <label className="label">Who pays *</label>
            <select value={fromMemberId} onChange={(e) => setFromMemberId(e.target.value)} className="field">
              <option value="">Select…</option>
              {group.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Who receives *</label>
            <select value={toMemberId} onChange={(e) => setToMemberId(e.target.value)} className="field">
              <option value="">Select…</option>
              {group.members.filter((m) => m.id !== fromMemberId).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Amount *</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="field" />
            </div>
            <div className="w-24">
              <label className="label">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="field">
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Date</label>
            <input type="date" value={settledAt} onChange={(e) => setSettledAt(e.target.value)} className="field" />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="field" />
          </div>
        </div>

        <div className="border-t border-[var(--border)] px-6 py-4">
          <button
            disabled={!fromMemberId || !toMemberId || !amount || fromMemberId === toMemberId || save.isPending}
            onClick={() => save.mutate({
              fromMemberId, toMemberId,
              amount: parseFloat(amount),
              currency, method,
              notes: notes.trim() || undefined,
              settledAt: new Date(settledAt).toISOString(),
            })}
            className="w-full rounded-lg bg-[var(--primary)] py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Record Settlement"}
          </button>
        </div>
      </div>

      <style>{`
        .label { display: block; margin-bottom: 6px; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-foreground); }
        .field { width: 100%; border-radius: 6px; border: 1px solid var(--border); background: var(--background); padding: 8px 12px; font-size: 14px; }
        .field:focus { outline: none; box-shadow: 0 0 0 2px var(--primary); }
      `}</style>
    </div>
  );
}
