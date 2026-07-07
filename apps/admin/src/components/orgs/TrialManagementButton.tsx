"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function TrialManagementButton({ orgId, currentStatus }: { orgId: string; currentStatus: string | null }) {
  // UI state
  const [open, setOpen] = useState(false);

  // Extend trial state
  const [extendDays, setExtendDays] = useState<7 | 14 | 30 | "custom">(7);
  const [customDays, setCustomDays] = useState(30);
  const [extending, setExtending] = useState(false);

  // Force status state
  const [newStatus, setNewStatus] = useState("");
  const [forcingStatus, setForcingStatus] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);

  const router = useRouter();

  const actualDays = extendDays === "custom" ? customDays : extendDays;

  const handleExtend = async () => {
    setExtending(true);
    try {
      await apiFetch(`/admin/organizations/${orgId}/extend-trial`, {
        method: "PATCH",
        body: JSON.stringify({ days: actualDays }),
      });
      toast.success(`Trial extended by ${actualDays} days`);
      router.refresh();
      setOpen(false);
    } catch {
      toast.error("Failed to extend trial");
    } finally {
      setExtending(false);
    }
  };

  const handleForceStatus = async () => {
    if (!newStatus) return;
    if (!window.confirm(`Force status to ${newStatus}?`)) return;
    setForcingStatus(true);
    try {
      await apiFetch(`/admin/organizations/${orgId}/subscription-status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(`Status set to ${newStatus}`);
      router.refresh();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setForcingStatus(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiFetch(`/admin/organizations/${orgId}/subscription-sync`, { method: "POST" });
      toast.success("Synced with Dodo");
      router.refresh();
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Extend Trial Section — only meaningful for orgs currently trialing */}
      {currentStatus === "TRIALING" ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--muted-foreground)]">Extend trial:</span>
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setExtendDays(d)}
              className={cn(
                "rounded border px-2 py-0.5 text-xs font-medium",
                extendDays === d
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)] hover:bg-[var(--muted)]"
              )}
            >
              {d}d
            </button>
          ))}
          <button
            onClick={() => setExtendDays("custom")}
            className={cn(
              "rounded border px-2 py-0.5 text-xs font-medium",
              extendDays === "custom"
                ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "border-[var(--border)] hover:bg-[var(--muted)]"
            )}
          >
            Custom
          </button>
          {extendDays === "custom" && (
            <input
              type="number"
              value={customDays}
              onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value)))}
              className="w-16 rounded border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-xs"
              min={1}
            />
          )}
          <button
            onClick={handleExtend}
            disabled={extending}
            className="rounded border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium hover:bg-[var(--muted)] disabled:opacity-50"
          >
            {extending ? "Extending…" : `Extend +${actualDays}d`}
          </button>
        </div>
      ) : (
        <span className="text-xs text-[var(--muted-foreground)]">
          Extend trial is only available for trialing organizations.
        </span>
      )}

      {/* Divider */}
      <span className="text-[var(--border)]">|</span>

      {/* Force Status */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--muted-foreground)]">Force status:</span>
        <select
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-xs"
        >
          <option value="">Select…</option>
          {["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={handleForceStatus}
          disabled={!newStatus || forcingStatus}
          className="rounded border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium hover:bg-[var(--muted)] disabled:opacity-50"
        >
          {forcingStatus ? "Applying…" : "Apply"}
        </button>
      </div>

      {/* Divider */}
      <span className="text-[var(--border)]">|</span>

      {/* Re-sync Dodo */}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="rounded border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium hover:bg-[var(--muted)] disabled:opacity-50"
      >
        {syncing ? "Syncing…" : "Re-sync with Dodo"}
      </button>
    </div>
  );
}
