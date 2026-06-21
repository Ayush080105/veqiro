"use client";
import { useState, useRef, KeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "SGD", "AUD", "CAD", "JPY", "AED"];

export function CreateGroupSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [nameInput, setNameInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addChip = () => {
    const trimmed = nameInput.trim();
    if (trimmed && !memberNames.includes(trimmed)) {
      setMemberNames((prev) => [...prev, trimmed]);
    }
    setNameInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChip();
    } else if (e.key === "Backspace" && !nameInput && memberNames.length > 0) {
      setMemberNames((prev) => prev.slice(0, -1));
    }
  };

  const removeChip = (n: string) => setMemberNames((prev) => prev.filter((x) => x !== n));

  const create = useMutation({
    mutationFn: (body: object) =>
      apiFetch("/expenses/groups", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", "groups"] });
      setName(""); setDescription(""); setCurrency("USD"); setMemberNames([]); setNameInput("");
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-[var(--card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold">New Expense Group</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Team Offsite, Office Lunch"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Default Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Members
            </label>
            <div
              onClick={() => inputRef.current?.focus()}
              className="flex min-h-[42px] cursor-text flex-wrap gap-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
            >
              {memberNames.map((n) => (
                <span
                  key={n}
                  className="flex items-center gap-1 rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-xs font-medium text-[var(--primary-foreground)]"
                >
                  {n}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeChip(n); }}
                    className="ml-0.5 rounded-full opacity-70 hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={addChip}
                placeholder={memberNames.length === 0 ? "Type a name and press Enter…" : ""}
                className="min-w-[120px] flex-1 bg-transparent text-sm focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">Press Enter or comma to add each person</p>
          </div>
        </div>

        <div className="border-t border-[var(--border)] px-6 py-4">
          <button
            disabled={!name.trim() || create.isPending}
            onClick={() =>
              create.mutate({
                name: name.trim(),
                description: description.trim() || undefined,
                currency,
                memberNames,
              })
            }
            className="w-full rounded-lg bg-[var(--primary)] py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
}
