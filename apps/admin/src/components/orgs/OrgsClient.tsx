"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Org = {
  id: string;
  name: string;
  slug: string;
  onboarded: boolean;
  createdAt: string;
  subscriptionStatus: string | null;
  plan: string | null;
  memberCount: number;
  ownerEmail: string | null;
  health?: {
    score: number;
    label: string; // "Healthy" | "Watch" | "At Risk"
    color: string; // "green" | "yellow" | "red"
  } | null;
};

type OrgsResponse = { orgs: Org[]; total: number; page: number; pageSize: number };

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Trialing", value: "TRIALING" },
  { label: "Past-Due", value: "PAST_DUE" },
  { label: "Cancelled", value: "CANCELLED" },
];

export function OrgsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  const currentPage = Number(searchParams.get("page") ?? "1");

  const [searchInput, setSearchInput] = useState(currentSearch);
  const [exporting, setExporting] = useState(false);
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());
  const [bulkDays, setBulkDays] = useState(7);
  const [bulkExtending, setBulkExtending] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v);
        else params.delete(k);
      });
      router.replace(`/organizations?${params.toString()}`);
    },
    [searchParams, router],
  );

  useEffect(() => {
    const t = setTimeout(() => updateParams({ search: searchInput, page: "" }), 300);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, error } = useQuery<OrgsResponse>({
    queryKey: ["admin", "orgs", currentSearch, currentStatus, currentPage, refetchKey],
    queryFn: () => {
      const p = new URLSearchParams();
      if (currentSearch) p.set("search", currentSearch);
      if (currentStatus) p.set("status", currentStatus);
      p.set("page", String(currentPage));
      return apiFetch<OrgsResponse>(`/admin/organizations?${p.toString()}`);
    },
  });

  // Clear selection when page/filter/data changes
  useEffect(() => {
    setSelectedOrgIds(new Set());
  }, [currentSearch, currentStatus, currentPage]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  const toggleSelect = (orgId: string) => {
    setSelectedOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    const visibleIds = data?.orgs.map((o) => o.id) ?? [];
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedOrgIds.has(id));
    if (allSelected) {
      setSelectedOrgIds(new Set());
    } else {
      setSelectedOrgIds(new Set(visibleIds));
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const BASE = `${process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:5000"}/api/${process.env.NEXT_PUBLIC_API_VERSION ?? "v1"}`;
      const res = await fetch(`${BASE}/admin/organizations/export`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `organizations-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const bulkExtendTrial = async () => {
    setBulkExtending(true);
    try {
      const data = await apiFetch<{ extended: number; skipped: string[] }>(
        "/admin/organizations/bulk-extend-trial",
        {
          method: "POST",
          body: JSON.stringify({ orgIds: [...selectedOrgIds], days: bulkDays }),
        },
      );
      toast.success(
        data.skipped.length > 0
          ? `Trial extended for ${data.extended} orgs (${data.skipped.length} skipped — not trialing)`
          : `Trial extended for ${data.extended} orgs`,
      );
      setSelectedOrgIds(new Set());
      setRefetchKey((k) => k + 1);
    } catch {
      toast.error("Bulk extend failed");
    } finally {
      setBulkExtending(false);
    }
  };

  const visibleIds = data?.orgs.map((o) => o.id) ?? [];
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedOrgIds.has(id));

  const selectedOrgs = data?.orgs.filter((o) => selectedOrgIds.has(o.id)) ?? [];
  const nonTrialingSelectedCount = selectedOrgs.filter(
    (o) => o.subscriptionStatus !== "TRIALING",
  ).length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Organizations</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or owner email…"
            className="w-72 rounded border border-[var(--border)] bg-[var(--card)] py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="flex gap-1">
          {STATUS_TABS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => updateParams({ status: value, page: "" })}
              className={cn(
                "rounded px-3 py-1 text-sm",
                currentStatus === value
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          disabled={exporting}
          className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-sm hover:bg-[var(--muted)] disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500">Failed to load organizations.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="cursor-pointer"
                  />
                </th>
                {["Name", "Owner", "Status", "Plan", "Members", "Onboarded", "Health", "Created"].map(
                  (h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data?.orgs.map((org) => (
                <tr key={org.id} className="hover:bg-[var(--muted)]">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedOrgIds.has(org.id)}
                      onChange={() => toggleSelect(org.id)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/organizations/${org.id}`} className="font-medium hover:underline">
                      {org.name}
                    </Link>
                    <p className="text-xs text-[var(--muted-foreground)]">/{org.slug}</p>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                    {org.ownerEmail ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={org.subscriptionStatus} />
                  </td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                    {org.plan ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">{org.memberCount}</td>
                  <td className="px-4 py-2.5 text-center">{org.onboarded ? "✓" : "—"}</td>
                  <td className="px-4 py-2.5">
                    {org.health ? (
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        org.health.color === "green" ? "bg-green-100 text-green-800" :
                        org.health.color === "yellow" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      )}>
                        {org.health.score} · {org.health.label}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                    {format(new Date(org.createdAt), "MMM d, yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.orgs.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
              No organizations found.
            </p>
          )}
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--muted-foreground)]">{data.total} total</p>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => updateParams({ page: String(currentPage - 1) })}
              className="rounded border border-[var(--border)] bg-[var(--card)] p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => updateParams({ page: String(currentPage + 1) })}
              className="rounded border border-[var(--border)] bg-[var(--card)] p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {selectedOrgIds.size >= 1 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedOrgIds.size} {selectedOrgIds.size === 1 ? "org" : "orgs"} selected
            </span>
            <span className="text-sm text-[var(--muted-foreground)]">—</span>
            <span className="text-sm">Extend trial by</span>
            <input
              type="number"
              value={bulkDays}
              onChange={(e) => setBulkDays(Math.max(1, Math.min(90, Number(e.target.value))))}
              className="w-16 rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm text-center"
              min={1} max={90}
            />
            <span className="text-sm">days</span>
            <button
              onClick={bulkExtendTrial}
              disabled={bulkExtending || nonTrialingSelectedCount > 0}
              className="rounded bg-[var(--primary)] px-3 py-1 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
            >
              {bulkExtending ? "Extending…" : "Extend"}
            </button>
            <button
              onClick={() => setSelectedOrgIds(new Set())}
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Clear
            </button>
          </div>
          {nonTrialingSelectedCount > 0 && (
            <p className="text-xs text-red-600">
              {nonTrialingSelectedCount} selected {nonTrialingSelectedCount === 1 ? "org isn't" : "orgs aren't"} trialing —
              deselect {nonTrialingSelectedCount === 1 ? "it" : "them"} to extend trial.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
