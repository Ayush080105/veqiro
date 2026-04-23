"use client"

import Link from "next/link"
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

import { FONT } from "@/components/veqiro/shared"
import { useIntegrations } from "@/lib/api/integrations"
import { useGoogleConnected } from "@/lib/api/auth-accounts"
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
  if (hit.accessTokenExpiresAt) {
    const expires = new Date(hit.accessTokenExpiresAt).getTime()
    const daysLeft = Math.floor((expires - Date.now()) / DAY_MS)
    if (daysLeft < 7) {
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

export function IntegrationHealth() {
  const { data: accounts = [] } = useIntegrations()
  const { data: googleConnected } = useGoogleConnected()

  const rows: Row[] = [
    {
      id: "google",
      label: "Google",
      state: googleConnected ? "connected" : "disconnected",
    },
    platformRow("twitter", "Twitter", "TWITTER", accounts),
    platformRow("linkedin", "LinkedIn", "LINKEDIN", accounts),
    platformRow("instagram", "Instagram", "INSTAGRAM", accounts),
    { id: "slack", label: "Slack", state: "coming-soon" },
    { id: "notion", label: "Notion", state: "coming-soon" },
  ]

  const stateStyles: Record<
    Row["state"],
    { bg: string; border: string; icon: React.ReactNode; text: string }
  > = {
    connected: {
      bg: "#DDF5E8",
      border: "#1DBC87",
      icon: <CheckCircle2 className="size-3.5" style={{ color: "#0E5C3F" }} />,
      text: "#0E5C3F",
    },
    disconnected: {
      bg: "#fff",
      border: "#111",
      icon: <XCircle className="size-3.5" style={{ color: "#555" }} />,
      text: "#555",
    },
    expiring: {
      bg: "#FFEFC4",
      border: "#B98700",
      icon: <AlertTriangle className="size-3.5" style={{ color: "#7A5A00" }} />,
      text: "#7A5A00",
    },
    "coming-soon": {
      bg: "#EFE7D6",
      border: "#111",
      icon: null,
      text: "#777",
    },
  }

  return (
    <div
      style={{
        background: "#FFF9ED",
        border: "3px solid #111",
        borderRadius: 16,
        boxShadow: "6px 6px 0 #111",
        padding: 20,
      }}
    >
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "#555",
        }}
      >
        [ integrations ]
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 26,
          letterSpacing: -0.5,
          color: "#111",
          marginTop: 2,
          marginBottom: 12,
        }}
      >
        plugged in?
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        {rows.map((r) => {
          const s = stateStyles[r.state]
          return (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                background: s.bg,
                border: `2px solid ${s.border}`,
                borderRadius: 8,
              }}
            >
              {s.icon}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "#111",
                  }}
                >
                  {r.label}
                </div>
                {r.meta && (
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9,
                      color: s.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.meta}
                  </div>
                )}
                {r.state === "coming-soon" && (
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9,
                      color: s.text,
                      letterSpacing: 1,
                    }}
                  >
                    coming soon
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <Link
          href="/settings/integrations"
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "#111",
            textDecoration: "none",
            padding: "8px 12px",
            background: "#fff",
            border: "2px solid #111",
            borderRadius: 999,
            boxShadow: "2px 2px 0 #111",
            display: "inline-block",
          }}
        >
          manage →
        </Link>
      </div>
    </div>
  )
}
