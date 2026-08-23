"use client"

import * as React from "react"
import { Check, AlertCircle, Clock } from "lucide-react"

import { FONT } from "@/lib/fonts"
import { getIntegrationBySlug } from "@repo/integrations-catalog"
import type { ToolTraceEntry } from "@/lib/types"

/**
 * The visible record of what an agent actually did on a turn.
 *
 * Chat is request/response (apps/ai's chat_sync), not streamed, so this can't
 * animate as the work happens — it renders once, after the fact. That still
 * covers the thing it exists for: the labour the user is paying for happened
 * behind a spinner before this, and a correct answer with no visible working
 * reads as a guess.
 *
 * Collapsed to a one-line summary by default so it never competes with the
 * reply itself; the detail is one click away.
 */

const statusIcon = {
  ok: Check,
  error: AlertCircle,
  pending: Clock,
} as const

const statusColor = {
  ok: "#0E5C3F",
  error: "#B91C1C",
  pending: "#7A5A00",
} as const

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function TraceLine({ entry }: { entry: ToolTraceEntry }) {
  const catalogEntry = entry.integration ? getIntegrationBySlug(entry.integration) : undefined
  // Fall back to the raw slug when a call came from a connection whose catalog
  // row has since been renamed or removed — better a slug than a blank cell.
  const systemName = catalogEntry?.name ?? entry.integration ?? "Veqiro"
  const Icon = statusIcon[entry.status]
  const color = statusColor[entry.status]

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "3px 0",
        fontFamily: FONT.mono,
        fontSize: 11,
        color: "rgba(0,0,0,0.62)",
        minWidth: 0,
      }}
    >
      <Icon className="size-3 shrink-0" style={{ color }} aria-hidden="true" />
      <span style={{ color: "#1A1A1A", fontWeight: 500, whiteSpace: "nowrap" }}>{systemName}</span>
      <span aria-hidden="true" style={{ color: "rgba(0,0,0,0.25)" }}>·</span>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {entry.label}
      </span>
      {entry.detail && (
        <span style={{ color, whiteSpace: "nowrap" }}>{entry.detail}</span>
      )}
      {entry.status === "pending" && (
        <span style={{ color, whiteSpace: "nowrap" }}>awaiting approval</span>
      )}
      {typeof entry.durationMs === "number" && (
        <span style={{ marginLeft: "auto", color: "rgba(0,0,0,0.35)", whiteSpace: "nowrap" }}>
          {formatDuration(entry.durationMs)}
        </span>
      )}
    </div>
  )
}

export function ToolTraceStrip({ trace }: { trace: ToolTraceEntry[] }) {
  const [open, setOpen] = React.useState(false)

  if (trace.length === 0) return null

  // Count distinct systems rather than calls — "3 systems" is the claim that
  // matters to the user; six calls against one inbox is not three systems.
  const systems = new Set(
    trace.map((t) => t.integration).filter((s): s is string => Boolean(s))
  )
  const failed = trace.filter((t) => t.status === "error").length

  const summary = [
    `${trace.length} ${trace.length === 1 ? "step" : "steps"}`,
    systems.size > 0 && `${systems.size} ${systems.size === 1 ? "system" : "systems"}`,
    failed > 0 && `${failed} failed`,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: 10,
        background: "#FAFAF7",
        marginTop: 6,
        maxWidth: 460,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "6px 10px",
          cursor: "pointer",
          fontFamily: FONT.mono,
          fontSize: 10.5,
          letterSpacing: "0.3px",
          textTransform: "uppercase",
          color: failed > 0 ? statusColor.error : "rgba(0,0,0,0.45)",
          textAlign: "left",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 120ms ease",
          }}
        >
          ›
        </span>
        <span>{open ? "What I did" : summary}</span>
      </button>

      {open && (
        <div style={{ padding: "0 10px 8px 10px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          {trace.map((entry, i) => (
            <TraceLine key={`${entry.label}-${i}`} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
