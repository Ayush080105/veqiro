"use client"

import Link from "next/link"
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useIntegrations } from "@/lib/api/integrations"
import type { SocialAccount } from "@/lib/api/integrations"

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
  accounts: SocialAccount[],
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

export function IntegrationHealth() {
  const { data: accounts = [] } = useIntegrations()

  const rows: Row[] = [
    platformRow("twitter", "Twitter", "TWITTER", accounts),
    platformRow("linkedin", "LinkedIn", "LINKEDIN", accounts),
  ]

  return (
    <div className="bg-card border-[3px] border-foreground rounded-2xl shadow-[6px_6px_0_var(--foreground)] p-5">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        [ integrations ]
      </div>
      <div className="font-display text-[26px] tracking-tight text-foreground mt-0.5 mb-3">
        plugged in?
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

      <div className="mt-4 pt-3.5 border-t-2 border-foreground/10 flex justify-end">
        <Button asChild variant="brand-ghost" size="brand-sm">
          <Link href="/settings/integrations">manage →</Link>
        </Button>
      </div>
    </div>
  )
}
