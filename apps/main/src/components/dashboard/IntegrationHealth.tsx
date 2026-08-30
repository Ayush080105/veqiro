"use client"

import Link from "next/link"
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import {
  useDashboardIntegrationHealth,
  type DashboardIntegrationHealth,
} from "@/lib/api/dashboard"
import { getIntegrationBySlug } from "@repo/integrations-catalog"

type Row = {
  id: string
  label: string
  state: "connected" | "disconnected" | "expiring" | "coming-soon"
  meta?: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function platformRow(
  id: string,
  label: string,
  platformEnum: "TWITTER" | "LINKEDIN" | "INSTAGRAM",
  accounts: DashboardIntegrationHealth["accounts"],
): Row {
  const hit = accounts.find((a) => a.platform === platformEnum)
  if (!hit) return { id, label, state: "disconnected" }
  const refreshableTwitter = platformEnum === "TWITTER" && hit.canRefresh
  if (hit.accessTokenExpiresAt) {
    const expires = new Date(hit.accessTokenExpiresAt).getTime()
    const daysLeft = Math.floor((expires - Date.now()) / DAY_MS)
    if (daysLeft < 7 && !refreshableTwitter) {
      return {
        id,
        label,
        state: "expiring",
        meta: daysLeft <= 0 ? "expired" : `${daysLeft}d left`,
      }
    }
  }
  return { id, label, state: "connected", meta: hit.accountName ?? undefined }
}

const stateClasses: Record<
  Row["state"],
  { row: string; metaColor: string }
> = {
  connected:     { row: "bg-[#DDF5E8] border-[#1DBC87]", metaColor: "#0E5C3F" },
  disconnected:  { row: "bg-white border-foreground",    metaColor: "#555555" },
  expiring:      { row: "bg-[#FFEFC4] border-[#B98700]", metaColor: "#7A5A00" },
  "coming-soon": { row: "bg-background border-foreground", metaColor: "#777777" },
}

/** MCP connections carry their own status, so they don't need the token-expiry
 *  reasoning the native OAuth rows above do — only ERROR is worth surfacing as
 *  a warning; anything not CONNECTED reads as simply not connected. */
function mcpRow(conn: DashboardIntegrationHealth["mcpConnections"][number]): Row {
  const label = getIntegrationBySlug(conn.slug)?.name ?? conn.slug
  if (conn.status === "CONNECTED") {
    return { id: conn.slug, label, state: "connected" }
  }
  if (conn.status === "ERROR") {
    return { id: conn.slug, label, state: "expiring", meta: "needs attention" }
  }
  return { id: conn.slug, label, state: "disconnected" }
}

/** Cap the grid so one heavily-connected org doesn't push the rest of the
 *  dashboard off-screen — the overflow is reported as a count instead. */
const MAX_ROWS = 6

export function IntegrationHealth() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const { data, isPending, isError, refetch } = useDashboardIntegrationHealth(organizationId)

  if (!data) {
    return (
      <div className="rounded-2xl border-[3px] border-foreground bg-card p-5 shadow-[6px_6px_0_var(--foreground)]">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          [ integrations ]
        </div>
        <div className="mt-0.5 font-display text-[26px] tracking-tight text-foreground">
          {isError ? "status unavailable" : "checking connections…"}
        </div>
        <p className="mt-2 font-body text-xs text-muted-foreground">
          {isError
            ? "Your connections are unchanged; this dashboard card could not refresh them."
            : "Loading your connected tools."}
        </p>
        {isError && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void refetch()}
          >
            Retry
          </Button>
        )}
        {isPending && <div className="mt-4 h-12 animate-pulse rounded-lg bg-muted" />}
      </div>
    )
  }

  const accounts = data?.accounts ?? []
  const mcpConnections = data?.mcpConnections ?? []

  // Native OAuth platforms and MCP connections are separate systems (see the
  // Legacy vs. catalog split in settings/integrations), so both are listed —
  // previously this widget showed only the two native rows and told an org
  // with eight live MCP connections that it had two integrations.
  const allRows: Row[] = [
    platformRow("twitter", "Twitter", "TWITTER", accounts),
    platformRow("linkedin", "LinkedIn", "LINKEDIN", accounts),
    ...mcpConnections.map(mcpRow),
  ]

  // Connected first, then anything needing attention — a disconnected row is
  // the least urgent thing here and shouldn't consume the visible slots.
  const rank: Record<Row["state"], number> = {
    expiring: 0,
    connected: 1,
    disconnected: 2,
    "coming-soon": 3,
  }
  const sorted = [...allRows].sort((a, b) => rank[a.state] - rank[b.state])
  const rows = sorted.slice(0, MAX_ROWS)
  const hiddenCount = sorted.length - rows.length
  const connectedCount = allRows.filter((r) => r.state === "connected").length

  return (
    <div className="bg-card border-[3px] border-foreground rounded-2xl shadow-[6px_6px_0_var(--foreground)] p-5">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        [ integrations ]
      </div>
      <div className="font-display text-[26px] tracking-tight text-foreground mt-0.5 mb-3">
        {connectedCount > 0 ? `${connectedCount} connected` : "plugged in?"}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((r) => {
          const cls = stateClasses[r.state]
          return (
            <div
              key={r.id}
              className={`flex items-center gap-2 px-2.5 py-2 border-2 rounded-lg ${cls.row}`}
            >
              {r.state === "connected"    && <CheckCircle2 className="size-3.5 shrink-0" style={{ color: "#0E5C3F" }} />}
              {r.state === "disconnected" && <XCircle className="size-3.5 shrink-0 text-muted-foreground" />}
              {r.state === "expiring"     && <AlertTriangle className="size-3.5 shrink-0" style={{ color: "#7A5A00" }} />}
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-foreground">
                  {r.label}
                </div>
                {r.meta && (
                  <div
                    className="font-mono text-[9px] truncate"
                    style={{ color: cls.metaColor }}
                  >
                    {r.meta}
                  </div>
                )}
                {r.state === "coming-soon" && (
                  <div
                    className="font-mono text-[9px] tracking-[0.1em]"
                    style={{ color: cls.metaColor }}
                  >
                    coming soon
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-3.5 border-t-2 border-foreground/10 flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {hiddenCount > 0 ? `+${hiddenCount} more` : ""}
        </div>
        <Button asChild variant="brand-ghost" size="brand-sm">
          <Link href="/settings/integrations">manage →</Link>
        </Button>
      </div>
    </div>
  )
}
