"use client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type IntegrationsData = {
  adoption: Array<{
    platform: string;
    orgCount: number;
    pctOfActiveOrgs: number;
  }>;
  expiringTokens: Array<{
    id: string;
    orgId: string;
    orgName: string;
    platform: string;
    accountName: string | null;
    accessTokenExpiresAt: string;
    status: "expired" | "expiring";
  }>;
  publishingStats: Array<{
    platform: string;
    total: number;
    published: number;
    failed: number;
    successRate: number;
  }>;
};

const PLATFORM_COLORS: Record<string, string> = {
  TWITTER: "#0ea5e9",   // sky-500
  LINKEDIN: "#2563eb",  // blue-600
  INSTAGRAM: "#ec4899", // pink-500
};

function platformColor(platform: string): string {
  return PLATFORM_COLORS[platform.toUpperCase()] ?? "var(--primary)";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function IntegrationsClient() {
  const { data, isLoading, error } = useQuery<IntegrationsData>({
    queryKey: ["admin", "integrations"],
    queryFn: () => apiFetch<IntegrationsData>("/admin/integrations"),
  });

  if (isLoading)
    return <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>;
  if (error || !data)
    return (
      <p className="text-sm text-red-500">Failed to load integrations data.</p>
    );

  const { adoption, expiringTokens, publishingStats } = data;

  const sortedExpiring = [...expiringTokens].sort(
    (a, b) =>
      new Date(a.accessTokenExpiresAt).getTime() -
      new Date(b.accessTokenExpiresAt).getTime(),
  );

  const allPublishingZero =
    publishingStats.length === 0 ||
    publishingStats.every((r) => r.total === 0);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Integrations</h1>

      {/* Section 1: Platform Adoption */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold">Platform Adoption</h2>
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {adoption.map((item) => (
            <div
              key={item.platform}
              className="rounded-md border border-[var(--border)] p-4"
            >
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: platformColor(item.platform) }}
              >
                {item.platform}
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                {item.orgCount}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {item.pctOfActiveOrgs.toFixed(1)}% of active orgs
              </p>
            </div>
          ))}
          {adoption.length === 0 && (
            <p className="col-span-3 text-sm text-[var(--muted-foreground)]">
              No adoption data yet.
            </p>
          )}
        </div>

        {adoption.length > 0 && (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart
              data={adoption}
              margin={{ top: 4, right: 0, left: -10, bottom: 0 }}
            >
              <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                formatter={(v) => [v, "orgs"]}
                labelFormatter={(l) => String(l)}
              />
              <Bar dataKey="orgCount" radius={[3, 3, 0, 0]}>
                {adoption.map((entry) => (
                  <Cell
                    key={entry.platform}
                    fill={platformColor(entry.platform)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Section 2: Expiring OAuth Tokens */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold">
          Expiring OAuth Tokens (next 14 days)
        </h2>
        {sortedExpiring.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No tokens expiring soon.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {["Org", "Platform", "Account", "Expires At", "Status"].map(
                    (h) => (
                      <th
                        key={h}
                        className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {sortedExpiring.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2">
                      <Link
                        href={`/organizations/${row.orgId}`}
                        className="font-medium hover:underline"
                      >
                        {row.orgName}
                      </Link>
                    </td>
                    <td className="py-2 text-xs text-[var(--muted-foreground)]">
                      {row.platform}
                    </td>
                    <td className="py-2 text-xs text-[var(--muted-foreground)]">
                      {row.accountName ?? "—"}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {fmtDate(row.accessTokenExpiresAt)}
                    </td>
                    <td className="py-2">
                      {row.status === "expired" ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          Expired
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          Expiring Soon
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Publishing Success Rates */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold">
          Publishing Success Rates (30 days)
        </h2>
        {allPublishingZero ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No publishing data for this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {[
                    "Platform",
                    "Total",
                    "Published",
                    "Failed",
                    "Success Rate",
                  ].map((h) => (
                    <th
                      key={h}
                      className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {publishingStats.map((row) => {
                  const rate = row.successRate;
                  const rateColor =
                    rate >= 80
                      ? "text-green-600 dark:text-green-400"
                      : rate >= 50
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400";
                  return (
                    <tr key={row.platform}>
                      <td className="py-2 font-medium">{row.platform}</td>
                      <td className="py-2 font-mono">{row.total}</td>
                      <td className="py-2 font-mono">{row.published}</td>
                      <td className="py-2 font-mono">{row.failed}</td>
                      <td className={`py-2 font-mono font-semibold ${rateColor}`}>
                        {rate.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
