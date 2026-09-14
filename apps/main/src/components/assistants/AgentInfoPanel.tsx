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
import type { AgentConfig, BrandKit } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-xs font-medium text-muted-foreground">
      {children}
    </div>
  )
}

const nativeControlClass =
  "rounded-[var(--vq-r-sm)] border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"

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
      <SectionLabel>context</SectionLabel>
      <div className="flex flex-col gap-1.5 rounded-[var(--vq-r)] border border-border bg-card p-3">
        {bits.map((b) => (
          <div key={b.k} className="text-xs text-foreground">
            <span className="opacity-50">{b.k}: </span>
            <span className="font-semibold">{b.v}</span>
          </div>
        ))}
        {swatches.length > 0 && (
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              palette
            </span>
            {swatches.map((c, i) => (
              <span
                key={i}
                title={c}
                className="inline-block size-3.5 rounded-[var(--vq-r-sm)] border border-border"
                style={{ background: c }}
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
      <SectionLabel>alert rules</SectionLabel>
      <div className="flex flex-col gap-2 rounded-[var(--vq-r)] border border-border bg-card p-3 shadow-(--vq-shadow-sm)">
        {rules.length === 0 && (
          <div className="text-xs text-muted-foreground">
            No alerts configured. Add rules to receive a daily email when thresholds trip.
          </div>
        )}
        {rules.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-1.5 rounded-[var(--vq-r-sm)] border border-border bg-background p-2"
          >
            <div className="flex items-center gap-1.5">
              <Input
                value={r.label ?? ""}
                placeholder="Label (e.g. Runway warning)"
                onChange={(e) => update(r.id, { label: e.target.value })}
                disabled={disabled}
                className="h-8 flex-1 text-xs"
              />
              <button
                type="button"
                onClick={() => update(r.id, { enabled: !r.enabled })}
                disabled={disabled}
                title={r.enabled ? "Disable" : "Enable"}
                className={cn(
                  "rounded-[var(--vq-r-sm)] border border-border px-2 py-1 text-xs font-medium disabled:opacity-50",
                  r.enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {r.enabled ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={disabled}
                aria-label="Remove alert rule"
                className="grid size-8 place-items-center rounded-[var(--vq-r-sm)] border border-border bg-card text-muted-foreground disabled:opacity-50"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-[1fr_1fr_80px] gap-1.5">
              <select
                value={r.metric}
                onChange={(e) => update(r.id, { metric: e.target.value })}
                disabled={disabled}
                className={nativeControlClass}
              >
                {ALERT_METRIC_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={r.operator}
                onChange={(e) => update(r.id, { operator: e.target.value as RexAlertRule["operator"] })}
                disabled={disabled}
                className={nativeControlClass}
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
                className={nativeControlClass}
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRule}
          disabled={disabled}
          className="self-start border-dashed"
        >
          + Add rule
        </Button>
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
      <SectionLabel>webhook ingest key</SectionLabel>
      <div className="flex flex-col gap-2 rounded-[var(--vq-r)] border border-border bg-card p-3 shadow-(--vq-shadow-sm)">
        <div className="text-xs leading-relaxed text-muted-foreground">
          POST <span className="text-foreground">/agents/rex/ingest</span> with{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            {`{ api_key, metric, date, value }`}
          </code>{" "}
          to append data points without UI.
        </div>
        {apiKey ? (
          <>
            <div className="flex items-center gap-1.5">
              <code
                onClick={() => setRevealed((v) => !v)}
                className="flex-1 cursor-pointer overflow-hidden rounded-[var(--vq-r-sm)] border border-border bg-background px-2.5 py-1.5 font-mono text-[11px] text-ellipsis whitespace-nowrap"
              >
                {revealed ? apiKey : `${apiKey.slice(0, 8)}••••••${apiKey.slice(-4)}`}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="self-start"
              onClick={() => revokeMut.mutate()}
              disabled={revokeMut.isPending}
            >
              Revoke key
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="brand-dark"
            size="sm"
            className="self-start"
            onClick={() => genMut.mutate()}
            disabled={genMut.isPending}
          >
            Generate API key
          </Button>
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
      <SectionLabel>rex settings</SectionLabel>
      <div className="flex flex-col gap-2.5 rounded-[var(--vq-r)] border border-border bg-card p-3 shadow-(--vq-shadow-sm)">
        {/* Weekly digest toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-body text-xs font-semibold text-foreground">
              Monday digest
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Weekly CFO email at 9am
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => mut.mutate({ weeklyDigestEnabled: v })}
            disabled={mut.isPending}
            aria-label={enabled ? "Disable weekly digest" : "Enable weekly digest"}
          />
        </div>

        {/* Timezone selector */}
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            timezone
          </div>
          <select
            value={tz}
            onChange={(e) => mut.mutate({ weeklyDigestTimezone: e.target.value })}
            disabled={mut.isPending || !enabled}
            className={cn(nativeControlClass, "w-full")}
          >
            {TZ_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert rules — daily threshold checks */}
      <div className="mt-4">
        <RexAlertsBlock
          rules={rules}
          disabled={mut.isPending}
          onChange={(next) => mut.mutate({ alertRules: next })}
        />
      </div>

      {/* Webhook ingest API key */}
      <div className="mt-4">
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

  const agentPhoto = `/agents/${agent.id}.jpeg`

  return (
    <>
      <div
        onClick={onClose}
        className="absolute inset-0 z-40 bg-black/40"
      />
      <aside
        role="dialog"
        aria-label={`${agent.name} info`}
        className="absolute inset-y-0 right-0 z-50 flex w-80 flex-col gap-4 overflow-auto border-l border-(--vq-line-2) bg-card p-5 shadow-(--vq-shadow-lg)"
      >
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close info"
            className="rounded-full"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div
          className="overflow-hidden rounded-[var(--vq-r)] border border-border shadow-(--vq-shadow-sm)"
          style={{ background: agent.color }}
        >
          <img src={agentPhoto} alt={agent.name} className="block h-full w-full object-cover" />
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {agent.role}
          </div>
          <div className="mt-0.5 font-display text-[44px] leading-none tracking-tight text-foreground">
            {agent.name.toLowerCase()}
          </div>
        </div>

        <p className="m-0 font-body text-sm leading-relaxed text-foreground/80 italic">
          &ldquo;{agent.tag}&rdquo;
        </p>

        <div>
          <SectionLabel>specialties</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {agent.specialties.map((s) => (
              <span
                key={s}
                className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>stats</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {agent.stats.map((s) => (
              <div
                key={s.k}
                className="flex items-baseline justify-between rounded-[var(--vq-r-sm)] border border-border bg-background px-2.5 py-1.5"
              >
                <span className="text-xs text-muted-foreground">
                  {s.k}
                </span>
                <span className="font-head text-[13px] text-foreground">
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
