"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type GrantCreditsResponse = {
  requested: number;
  applied: number;
  after: { used: number; limit: number; remaining: number };
};

export function GrantCreditsButton({ orgId }: { orgId: string }) {
  const [amount, setAmount] = useState(50);
  const [granting, setGranting] = useState(false);
  const router = useRouter();

  const handleGrant = async () => {
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Enter a positive whole number of credits");
      return;
    }
    setGranting(true);
    try {
      const data = await apiFetch<GrantCreditsResponse>(
        `/admin/organizations/${orgId}/grant-credits`,
        { method: "POST", body: JSON.stringify({ credits: amount }) },
      );
      if (data.applied < data.requested) {
        toast.success(
          `Granted ${data.applied} of ${data.requested} credits — org is now at its ${data.after.limit}-credit cap`,
        );
      } else {
        toast.success(`Granted ${data.applied} credits`);
      }
      router.refresh();
    } catch {
      toast.error("Failed to grant credits");
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--muted-foreground)]">Grant credits:</span>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
        className="w-20 rounded border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-xs"
        min={1}
      />
      <button
        onClick={handleGrant}
        disabled={granting}
        className="rounded border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium hover:bg-[var(--muted)] disabled:opacity-50"
      >
        {granting ? "Granting…" : "Grant"}
      </button>
    </div>
  );
}
