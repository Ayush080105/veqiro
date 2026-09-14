"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, Plug, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState"
import { authClient } from "@/lib/auth-client"
import {
  useDashboardIntegrationHealth,
  type DashboardIntegrationHealth,
} from "@/lib/api/dashboard"
import { getIntegrationBySlug } from "@repo/integrations-catalog"
import { IntegrationLogo } from "@/components/integrations/IntegrationCatalogCard"
import { cn } from "@/lib/utils"

type Row = {
  id: string
  label: string
  state: "connected" | "disconnected" | "expiring" | "coming-soon"
  logoUrl?: string
  meta?: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_ROWS = 6

function platformRow(
  id: string,
  label: string,
  platformEnum: "TWITTER" | "LINKEDIN" | "INSTAGRAM",
  accounts: DashboardIntegrationHealth["accounts"],
): Row {
  const hit = accounts.find((a) => a.platform === platformEnum)
  const logoUrl = getIntegrationBySlug(id)?.logoUrl
  if (!hit) return { id, label, state: "disconnected", logoUrl }
  const refreshableTwitter = platformEnum === "TWITTER" && hit.canRefresh
  if (hit.accessTokenExpiresAt) {
    const expires = new Date(hit.accessTokenExpiresAt).getTime()
    const daysLeft = Math.floor((expires - Date.now()) / DAY_MS)
    if (daysLeft < 7 && !refreshableTwitter) {
      return {
        id,
        label,
        state: "expiring",
        logoUrl,
        meta: daysLeft <= 0 ? "Expired - reconnect" : `${daysLeft}d left`,
      }
    }
  }
  return { id, label, state: "connected", logoUrl, meta: hit.accountName ?? undefined }
}

function mcpRow(conn: DashboardIntegrationHealth["mcpConnections"][number]): Row {
  const integration = getIntegrationBySlug(conn.slug)
  const label = integration?.name ?? conn.slug
  const logoUrl = integration?.logoUrl
  if (conn.status === "CONNECTED") return { id: conn.slug, label, logoUrl, state: "connected" }
  if (conn.status === "ERROR") return { id: conn.slug, label, logoUrl, state: "expiring", meta: "needs attention" }
  return { id: conn.slug, label, logoUrl, state: "disconnected" }
}

const stateClasses: Record<Row["state"], { row: string; meta: string; icon: string }> = {
  connected:     { row: "border-border bg-card", meta: "text-muted-foreground", icon: "text-[color:var(--vq-green)]" },
  disconnected:  { row: "border-border bg-card", meta: "text-muted-foreground", icon: "text-muted-foreground" },
  expiring:      { row: "border-border bg-muted/50", meta: "text-muted-foreground", icon: "text-destructive" },
  "coming-soon": { row: "border-border bg-muted/30", meta: "text-muted-foreground", icon: "text-muted-foreground" },
}

export function IntegrationHealth() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const { data, isPending, isError, refetch } = useDashboardIntegrationHealth(organizationId)

  if (!data) {
    return (
      <div className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
        <div className="mb-3 font-head text-2xl text-foreground">
          {isError ? "Connection status unavailable" : "Checking connections..."}
        </div>
        {isError ? (
          <DashboardEmptyState
            icon={AlertTriangle}
            title="Could not refresh connections"
            description="Your saved connections are unchanged. Retry to reload their dashboard status."
            action={{ label: "Retry", onClick: () => void refetch() }}
            tone="danger"
          />
        ) : (
          <p className="font-body text-xs text-muted-foreground">Loading your connected tools.</p>
        )}
        {isPending && <div className="mt-4 h-12 animate-pulse rounded-[var(--vq-r-sm)] bg-muted" />}
      </div>
    )
  }

  const accounts = data?.accounts ?? []
  const mcpConnections = data?.mcpConnections ?? []
  const allRows: Row[] = [
    platformRow("twitter", "Twitter", "TWITTER", accounts),
    platformRow("linkedin", "LinkedIn", "LINKEDIN", accounts),
    platformRow("instagram", "Instagram", "INSTAGRAM", accounts),
    ...mcpConnections.map(mcpRow),
  ]
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
  const attentionCount = allRows.filter((r) => r.state === "expiring").length
  const visibleRows = connectedCount === 0 && attentionCount === 0 ? [] : rows

  return (
    <div className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
      <div className="mb-3">
        <div className="font-head text-2xl text-foreground">
          {attentionCount > 0
            ? `${connectedCount} connected, ${attentionCount} needs attention`
            : connectedCount > 0
              ? `${connectedCount} connected`
              : "No tools connected"}
        </div>
        <p className="m-0 mt-1 text-xs text-muted-foreground">OAuth and app connections.</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {connectedCount === 0 && (
          <div className="sm:col-span-2">
            <DashboardEmptyState
              icon={Plug}
              title="Connect your first tool"
              description="Give agents access to Gmail, Calendar, LinkedIn, Instagram, Notion, and more."
              action={{ label: "Manage integrations", href: "/settings/integrations" }}
              compact
            />
          </div>
        )}
        {visibleRows.map((r) => {
          const cls = stateClasses[r.state]
          return (
            <div
              key={r.id}
              className={`flex items-center gap-2 rounded-[var(--vq-r-sm)] border px-2.5 py-2 ${cls.row}`}
            >
              <IntegrationLogo name={r.label} logoUrl={r.logoUrl} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-foreground">{r.label}</div>
                {r.meta && <div className={cn("truncate text-[11px]", cls.meta)}>{r.meta}</div>}
                {r.state === "coming-soon" && (
                  <div className={cn("text-[11px]", cls.meta)}>coming soon</div>
                )}
              </div>
              {r.state === "connected" && <CheckCircle2 className={cn("size-3.5 shrink-0", cls.icon)} />}
              {r.state === "disconnected" && <XCircle className={cn("size-3.5 shrink-0", cls.icon)} />}
              {r.state === "expiring" && <AlertTriangle className={cn("size-3.5 shrink-0", cls.icon)} />}
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3.5">
        <div className="text-[11px] text-muted-foreground">
          {hiddenCount > 0 ? `+${hiddenCount} more` : ""}
        </div>
        <Button asChild variant="brand-ghost" size="brand-sm">
          <Link href="/settings/integrations">Manage</Link>
        </Button>
      </div>
    </div>
  )
}
