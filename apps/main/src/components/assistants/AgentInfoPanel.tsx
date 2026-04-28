"use client"

import * as React from "react"
import { useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"

import {
  getSettings,
  patchSettings,
  generateApiKey,
  revokeApiKey,
} from "@/lib/api/rex"
import type { RexAlertRule } from "@/lib/types/agents"
import { CHARACTER_COMPONENTS } from "@/components/veqiro/characters"
import { FONT } from "@/lib/fonts"
import type { AgentConfig, BrandKit } from "@/lib/types"

function ContextBlock({ kit }: { kit: BrandKit | null }) {
  if (!kit || !kit.companyName) return null
  const swatches = [
    kit.brandColors?.primary,
    kit.brandColors?.secondary,
    kit.brandColors?.accent,
  ].filter(Boolean) as string[]

  const bits: { k: string; v: string }[] = []
  if (kit.companyName) bits.push({ k: "brand", v: kit.companyName })
  if (kit.industry) bits.push({ k: "industry", v: kit.industry })
  if (kit.brandVoice) bits.push({ k: "voice", v: kit.brandVoice })

  return (
    <div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#555",
          marginBottom: 8,
        }}
      >
        context
      </div>
      <div
        style={{
          background: "#fff",
          border: "2px dashed #111",
          borderRadius: 10,
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {bits.map((b) => (
          <div key={b.k} style={{ fontFamily: FONT.mono, fontSize: 11, color: "#111" }}>
            <span style={{ opacity: 0.5 }}>{b.k}: </span>
            <span style={{ fontWeight: 600 }}>{b.v}</span>
          </div>
        ))}
        {swatches.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "#555",
              }}
            >
              palette
            </span>
            {swatches.map((c, i) => (
              <span
                key={i}
                title={c}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: c,
                  border: "1.5px solid #111",
                  display: "inline-block",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const TZ_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
]

const ALERT_METRIC_OPTIONS = [
  "mrr", "arr", "cash", "burn", "expenses", "churn_rate", "growth_rate", "new_customers", "cac", "ltv", "runway",
]

const OPERATOR_LABEL: Record<RexAlertRule["operator"], string> = {
  lt: "drops below",
  gt: "exceeds",
  change_gt_pct: "jumps WoW > %",
  change_lt_pct: "falls WoW > %",
}

function makeRuleId() {
  return Math.random().toString(36).slice(2, 10)
}

function RexAlertsBlock({
  rules,
  onChange,
  disabled,
}: {
  rules: RexAlertRule[]
  onChange: (next: RexAlertRule[]) => void
  disabled?: boolean
}) {
  const addRule = () => {
    onChange([
      ...rules,
      { id: makeRuleId(), metric: "runway", operator: "lt", threshold: 6, enabled: true, label: "Runway warning" },
    ])
  }
  const update = (id: string, patch: Partial<RexAlertRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const remove = (id: string) => onChange(rules.filter((r) => r.id !== id))

  return (
    <div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#555",
          marginBottom: 8,
        }}
      >
        alert rules
      </div>
      <div
        style={{
          background: "#fff",
          border: "2px solid #111",
          borderRadius: 10,
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {rules.length === 0 && (
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: "#888" }}>
            No alerts configured. Add rules to receive a daily email when thresholds trip.
          </div>
        )}
        {rules.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              border: "1px dashed #ccc",
              borderRadius: 6,
              padding: 8,
            }}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                value={r.label ?? ""}
                placeholder="Label (e.g. Runway warning)"
                onChange={(e) => update(r.id, { label: e.target.value })}
                disabled={disabled}
                style={{
                  flex: 1,
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  padding: "4px 6px",
                  border: "1px solid #111",
                  borderRadius: 4,
                  background: "#FFF9ED",
                }}
              />
              <button
                type="button"
                onClick={() => update(r.id, { enabled: !r.enabled })}
                disabled={disabled}
                title={r.enabled ? "Disable" : "Enable"}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  padding: "4px 8px",
                  border: "1.5px solid #111",
                  borderRadius: 4,
                  background: r.enabled ? "#1DBC87" : "#e0e0e0",
                  color: r.enabled ? "#fff" : "#555",
                  cursor: "pointer",
                }}
              >
                {r.enabled ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={disabled}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  padding: "4px 6px",
                  border: "1.5px solid #111",
                  borderRadius: 4,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 6 }}>
              <select
                value={r.metric}
                onChange={(e) => update(r.id, { metric: e.target.value })}
                disabled={disabled}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  padding: "4px 6px",
                  border: "1px solid #111",
                  borderRadius: 4,
                  background: "#FFF9ED",
                }}
              >
                {ALERT_METRIC_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={r.operator}
                onChange={(e) => update(r.id, { operator: e.target.value as RexAlertRule["operator"] })}
                disabled={disabled}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  padding: "4px 6px",
                  border: "1px solid #111",
                  borderRadius: 4,
                  background: "#FFF9ED",
                }}
              >
                {Object.entries(OPERATOR_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input
                type="number"
                value={r.threshold}
                onChange={(e) => update(r.id, { threshold: Number(e.target.value) })}
                disabled={disabled}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  padding: "4px 6px",
                  border: "1px solid #111",
                  borderRadius: 4,
                  background: "#FFF9ED",
                }}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addRule}
          disabled={disabled}
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            padding: "6px 10px",
            border: "2px dashed #111",
            borderRadius: 6,
            background: "#FFF9ED",
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          + Add rule
        </button>
      </div>
    </div>
  )
}

function RexApiKeyBlock({ organizationId, apiKey }: { organizationId: string; apiKey: string | null | undefined }) {
  const qc = useQueryClient()
  const [revealed, setRevealed] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const genMut = useMutation({
    mutationFn: () => generateApiKey(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rex", "settings", organizationId] })
      setRevealed(true)
    },
  })
  const revokeMut = useMutation({
    mutationFn: () => revokeApiKey(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rex", "settings", organizationId] }),
  })

  const copy = () => {
    if (!apiKey) return
    void navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#555",
          marginBottom: 8,
        }}
      >
        webhook ingest key
      </div>
      <div
        style={{
          background: "#fff",
          border: "2px solid #111",
          borderRadius: 10,
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 10, color: "#777", lineHeight: 1.5 }}>
          POST <span style={{ color: "#111" }}>/agents/rex/ingest</span> with{" "}
          <code style={{ background: "#f5f5f5", padding: "1px 4px", borderRadius: 3 }}>
            {`{ api_key, metric, date, value }`}
          </code>{" "}
          to append data points without UI.
        </div>
        {apiKey ? (
          <>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <code
                onClick={() => setRevealed((v) => !v)}
                style={{
                  flex: 1,
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  padding: "6px 8px",
                  background: "#FFF9ED",
                  border: "1.5px solid #111",
                  borderRadius: 4,
                  cursor: "pointer",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {revealed ? apiKey : `${apiKey.slice(0, 8)}••••••${apiKey.slice(-4)}`}
              </code>
              <button
                type="button"
                onClick={copy}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  padding: "6px 10px",
                  border: "1.5px solid #111",
                  borderRadius: 4,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => revokeMut.mutate()}
              disabled={revokeMut.isPending}
              style={{
                alignSelf: "flex-start",
                fontFamily: FONT.mono,
                fontSize: 10,
                padding: "4px 10px",
                border: "1.5px solid #ef4444",
                borderRadius: 4,
                background: "#fff",
                color: "#ef4444",
                cursor: "pointer",
              }}
            >
              Revoke key
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => genMut.mutate()}
            disabled={genMut.isPending}
            style={{
              alignSelf: "flex-start",
              fontFamily: FONT.mono,
              fontSize: 11,
              padding: "6px 12px",
              border: "2px solid #111",
              borderRadius: 6,
              background: "#1DBC87",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "2px 2px 0 #111",
            }}
          >
            Generate API key
          </button>
        )}
      </div>
    </div>
  )
}

function RexSettingsBlock({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient()
  const { data: settings, isLoading } = useQuery({
    queryKey: ["rex", "settings", organizationId],
    queryFn: getSettings,
    enabled: !!organizationId,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
  const mut = useMutation({
    mutationFn: (patch: Parameters<typeof patchSettings>[0]) => patchSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rex", "settings", organizationId] }),
  })

  const enabled = settings?.weeklyDigestEnabled ?? true
  const tz = settings?.weeklyDigestTimezone ?? "UTC"
  const rules = (settings?.alertRules ?? []) as RexAlertRule[]

  if (isLoading) return null

  return (
    <div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#555",
          marginBottom: 8,
        }}
      >
        rex settings
      </div>
      <div
        style={{
          background: "#fff",
          border: "2px solid #111",
          borderRadius: 10,
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Weekly digest toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT.body, fontSize: 12, fontWeight: 600, color: "#111" }}>
              Monday digest
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 10, color: "#777", marginTop: 2 }}>
              Weekly CFO email at 9am
            </div>
          </div>
          <button
            type="button"
            onClick={() => mut.mutate({ weeklyDigestEnabled: !enabled })}
            disabled={mut.isPending}
            aria-label={enabled ? "Disable weekly digest" : "Enable weekly digest"}
            style={{
              flexShrink: 0,
              width: 44,
              height: 24,
              borderRadius: 999,
              border: "2px solid #111",
              background: enabled ? "#1DBC87" : "#e0e0e0",
              cursor: "pointer",
              position: "relative",
              transition: "background 180ms",
              boxShadow: "2px 2px 0 #111",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: enabled ? 20 : 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#fff",
                border: "1.5px solid #111",
                transition: "left 180ms",
              }}
            />
          </button>
        </div>

        {/* Timezone selector */}
        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "#555",
              marginBottom: 4,
            }}
          >
            timezone
          </div>
          <select
            value={tz}
            onChange={(e) => mut.mutate({ weeklyDigestTimezone: e.target.value })}
            disabled={mut.isPending || !enabled}
            style={{
              width: "100%",
              fontFamily: FONT.mono,
              fontSize: 11,
              padding: "5px 8px",
              border: "2px solid #111",
              borderRadius: 6,
              background: enabled ? "#FFF9ED" : "#f5f5f5",
              color: "#111",
              cursor: enabled ? "pointer" : "not-allowed",
              opacity: enabled ? 1 : 0.5,
            }}
          >
            {TZ_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert rules — daily threshold checks */}
      <div style={{ marginTop: 18 }}>
        <RexAlertsBlock
          rules={rules}
          disabled={mut.isPending}
          onChange={(next) => mut.mutate({ alertRules: next })}
        />
      </div>

      {/* Webhook ingest API key */}
      <div style={{ marginTop: 18 }}>
        <RexApiKeyBlock organizationId={organizationId} apiKey={settings?.ingestApiKey} />
      </div>
    </div>
  )
}

export default function AgentInfoPanel({
  agent,
  kit,
  open,
  onClose,
  organizationId = "",
}: {
  agent: AgentConfig
  kit: BrandKit | null
  open: boolean
  onClose: () => void
  organizationId?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const Portrait = CHARACTER_COMPONENTS[agent.id]

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.25)",
          zIndex: 40,
        }}
      />
      <aside
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 320,
          background: "#FFF9ED",
          borderLeft: "3px solid #111",
          padding: "20px 18px",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          zIndex: 41,
          boxShadow: "-6px 0 0 #111",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close info"
            style={{
              background: "#fff",
              border: "2px solid #111",
              borderRadius: 999,
              padding: 6,
              cursor: "pointer",
              boxShadow: "2px 2px 0 #111",
              display: "grid",
              placeItems: "center",
            }}
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          style={{
            background: agent.color,
            border: "3px solid #111",
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: "6px 6px 0 #111",
            transform: "rotate(-1.5deg)",
          }}
        >
          {Portrait ? <Portrait size="100%" /> : null}
        </div>

        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#555",
            }}
          >
            {agent.role}
          </div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 44,
              lineHeight: 1,
              color: "#111",
              letterSpacing: -1,
              marginTop: 2,
            }}
          >
            {agent.name.toLowerCase()}
          </div>
        </div>

        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 14,
            lineHeight: 1.5,
            color: "#333",
            margin: 0,
            fontStyle: "italic",
          }}
        >
          &ldquo;{agent.tag}&rdquo;
        </p>

        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#555",
              marginBottom: 8,
            }}
          >
            specialties
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {agent.specialties.map((s) => (
              <span
                key={s}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  padding: "4px 10px",
                  background: "#fff",
                  border: "2px solid #111",
                  borderRadius: 999,
                  color: "#111",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#555",
              marginBottom: 8,
            }}
          >
            stats
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {agent.stats.map((s) => (
              <div
                key={s.k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "6px 10px",
                  background: "#fff",
                  border: "2px solid #111",
                  borderRadius: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "#555",
                  }}
                >
                  {s.k}
                </span>
                <span
                  style={{
                    fontFamily: FONT.head,
                    fontSize: 13,
                    color: "#111",
                  }}
                >
                  {s.v}
                </span>
              </div>
            ))}
          </div>
        </div>

        <ContextBlock kit={kit} />

        {agent.id === "rex" && organizationId && (
          <RexSettingsBlock organizationId={organizationId} />
        )}
      </aside>
    </>
  )
}
