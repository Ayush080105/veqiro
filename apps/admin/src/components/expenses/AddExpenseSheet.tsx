"use client";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Upload, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { CATEGORIES } from "./types";
import type { ExpenseGroup, Expense } from "./types";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "SGD", "AUD", "CAD", "JPY", "AED"];
const CRON_PRESETS = [
  { label: "Daily", value: "0 9 * * *" },
  { label: "Weekly", value: "0 9 * * 1" },
  { label: "Monthly", value: "0 9 1 * *" },
];

type SplitInput = { memberId: string; splitType: "EQUAL" | "EXACT" | "PERCENTAGE"; shareAmount: number };

function buildEqualSplits(members: ExpenseGroup["members"], amount: number): SplitInput[] {
  if (!members.length) return [];
  const share = parseFloat((amount / members.length).toFixed(2));
  return members.map((m) => ({ memberId: m.id, splitType: "EQUAL", shareAmount: share }));
}

export function AddExpenseSheet({
  open,
  onClose,
  group,
  expense,
}: {
  open: boolean;
  onClose: () => void;
  group: ExpenseGroup;
  expense?: Expense;
}) {
  const qc = useQueryClient();
  const isEdit = !!expense;

  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(String(expense?.amount ?? ""));
  const [currency, setCurrency] = useState(expense?.currency ?? group.currency);
  const [category, setCategory] = useState(expense?.category ?? "OTHER");
  const [paidByMemberId, setPaidById] = useState(expense?.paidByMemberId ?? group.members[0]?.id ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [date, setDate] = useState(expense?.date ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [receiptUrl, setReceiptUrl] = useState(expense?.receiptUrl ?? "");
  const [isRecurring, setIsRecurring] = useState(expense?.isRecurring ?? false);
  const [cronExpression, setCronExpression] = useState(expense?.cronExpression ?? "0 9 * * *");
  const [splitType, setSplitType] = useState<"EQUAL" | "EXACT" | "PERCENTAGE">("EQUAL");
  const [splits, setSplits] = useState<SplitInput[]>([]);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const amt = parseFloat(amount) || 0;

  useEffect(() => {
    if (splitType === "EQUAL" && amt > 0) {
      setSplits(buildEqualSplits(group.members, amt));
    } else if (splits.length === 0) {
      setSplits(group.members.map((m) => ({ memberId: m.id, splitType, shareAmount: 0 })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitType, amt, group.members.length]);

  const updateSplit = (memberId: string, shareAmount: number) => {
    setSplits((prev) => prev.map((s) => s.memberId === memberId ? { ...s, shareAmount } : s));
  };

  const splitsTotal = splits.reduce((s, x) => s + x.shareAmount, 0);
  const splitsValid =
    splitType === "PERCENTAGE"
      ? Math.abs(splitsTotal - 100) < 0.01
      : Math.abs(splitsTotal - amt) < 0.01;

  const save = useMutation({
    mutationFn: (body: object) =>
      isEdit
        ? apiFetch(`/expenses/expenses/${expense!.id}`, { method: "PUT", body: JSON.stringify(body) })
        : apiFetch(`/expenses/groups/${group.id}/expenses`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", "expenses", group.id] });
      qc.invalidateQueries({ queryKey: ["expenses", "balances", group.id] });
      qc.invalidateQueries({ queryKey: ["expenses", "stats", group.id] });
      qc.invalidateQueries({ queryKey: ["expenses", "activity", group.id] });
      onClose();
    },
  });

  const handleReceiptUpload = async (file: File) => {
    setUploadingReceipt(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:5000"}/api/${process.env.NEXT_PUBLIC_API_VERSION ?? "v1"}/expenses/upload-receipt`,
        { method: "POST", credentials: "include", body: fd },
      );
      if (!result.ok) throw new Error("Upload failed");
      const { url } = await result.json() as { url: string };
      setReceiptUrl(url);
    } catch {
      alert("Receipt upload failed");
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmit = () => {
    if (!title.trim() || !amt || !paidByMemberId) return;
    save.mutate({
      title: title.trim(),
      amount: amt,
      currency,
      category,
      paidByMemberId,
      notes: notes.trim() || undefined,
      date: new Date(date).toISOString(),
      receiptUrl: receiptUrl || undefined,
      isRecurring,
      cronExpression: isRecurring ? cronExpression : undefined,
      splits: splits.map((s) => ({ ...s, splitType })),
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-[var(--card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold">{isEdit ? "Edit Expense" : "Add Expense"}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--muted)]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-5 p-6">
          {/* Title */}
          <div>
            <label className="label">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Team lunch" className="field" />
          </div>

          {/* Amount + Currency */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Amount *</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="field" />
            </div>
            <div className="w-28">
              <label className="label">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Category + Date */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="field">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="label">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
            </div>
          </div>

          {/* Paid by */}
          <div>
            <label className="label">Paid by *</label>
            <select value={paidByMemberId} onChange={(e) => setPaidById(e.target.value)} className="field">
              {group.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Split type */}
          <div>
            <label className="label">Split</label>
            <div className="flex gap-1 rounded-lg bg-[var(--muted)] p-1">
              {(["EQUAL", "EXACT", "PERCENTAGE"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSplitType(t)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    splitType === t ? "bg-[var(--card)] text-[var(--foreground)] shadow" : "text-[var(--muted-foreground)]"
                  }`}
                >
                  {t === "EQUAL" ? "Equal" : t === "EXACT" ? "Exact $" : "Percent %"}
                </button>
              ))}
            </div>

            <div className="mt-2 space-y-1.5">
              {splits.map((s) => {
                const member = group.members.find((m) => m.id === s.memberId);
                return (
                  <div key={s.memberId} className="flex items-center gap-3">
                    <span className="w-28 truncate text-sm">{member?.name ?? s.memberId}</span>
                    {splitType === "EQUAL" ? (
                      <span className="text-sm text-[var(--muted-foreground)]">
                        {currency} {s.shareAmount.toFixed(2)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={s.shareAmount}
                        onChange={(e) => updateSplit(s.memberId, parseFloat(e.target.value) || 0)}
                        className="w-28 rounded border border-[var(--border)] px-2 py-1 text-sm"
                      />
                    )}
                    {splitType === "PERCENTAGE" && <span className="text-xs text-[var(--muted-foreground)]">%</span>}
                  </div>
                );
              })}
              {splitType !== "EQUAL" && (
                <p className={`text-xs ${splitsValid ? "text-green-600" : "text-red-500"}`}>
                  Total: {splitsTotal.toFixed(2)}{splitType === "PERCENTAGE" ? "%" : ` ${currency}`}
                  {!splitsValid && ` (expected ${splitType === "PERCENTAGE" ? 100 : amt.toFixed(2)})`}
                </p>
              )}
            </div>
          </div>

          {/* Receipt */}
          <div>
            <label className="label">Receipt</label>
            {receiptUrl ? (
              <div className="flex items-center gap-2">
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline truncate max-w-xs">
                  View receipt
                </a>
                <button onClick={() => setReceiptUrl("")} className="text-xs text-red-500">Remove</button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-[var(--border)] px-4 py-3 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
                <Upload className="h-4 w-4" />
                {uploadingReceipt ? "Uploading…" : "Upload receipt (image or PDF)"}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(f); }}
                />
              </label>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="field" />
          </div>

          {/* Recurring */}
          <div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="h-4 w-4 rounded" />
              <RefreshCw className="h-3.5 w-3.5" />
              Recurring expense
            </label>
            {isRecurring && (
              <div className="mt-2">
                <label className="label">Cron schedule</label>
                <div className="mb-2 flex flex-wrap gap-1">
                  {CRON_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setCronExpression(p.value)}
                      className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                        cronExpression === p.value ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} placeholder="e.g. 0 9 * * 1" className="field font-mono text-xs" />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[var(--border)] px-6 py-4">
          <button
            disabled={!title.trim() || !amt || !paidByMemberId || save.isPending || (splitType !== "EQUAL" && !splitsValid)}
            onClick={handleSubmit}
            className="w-full rounded-lg bg-[var(--primary)] py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Expense"}
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
