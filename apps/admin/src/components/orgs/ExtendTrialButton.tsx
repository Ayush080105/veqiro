"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export function ExtendTrialButton({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleExtend = async () => {
    setLoading(true);
    try {
      await apiFetch(`/admin/organizations/${orgId}/extend-trial`, {
        method: "PATCH",
      });
      toast.success("Trial extended by 7 days");
      router.refresh();
    } catch {
      toast.error("Failed to extend trial");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExtend}
      disabled={loading}
      className="rounded border border-[var(--border)] bg-white px-4 py-1.5 text-sm hover:bg-[var(--muted)] disabled:opacity-50"
    >
      {loading ? "Extending…" : "Extend Trial (+7 days)"}
    </button>
  );
}
