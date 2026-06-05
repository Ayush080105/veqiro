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
    queryKey: ["admin", "orgs", currentSearch, currentStatus, currentPage],
    queryFn: () => {
      const p = new URLSearchParams();
      if (currentSearch) p.set("search", currentSearch);
      if (currentStatus) p.set("status", currentStatus);
      p.set("page", String(currentPage));
      return apiFetch<OrgsResponse>(`/admin/organizations?${p.toString()}`);
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

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
                {["Name", "Owner", "Status", "Plan", "Members", "Onboarded", "Created"].map(
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
    </div>
  );
}
