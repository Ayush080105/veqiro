"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Check, X, Loader2, Clock, PenLine, Ban, MinusCircle } from "lucide-react"
import { getIntegrationBySlug } from "@repo/integrations-catalog"
import type { AgentRunStep, AgentRunStepStatus } from "@/lib/types/runs"
import { agentColorFor } from "./agentColor"
import { NODE_WIDTH, NODE_HEIGHT } from "./runLayout"

export interface RunStepNodeData extends Record<string, unknown> {
  step: AgentRunStep
  agentColor: string
  /** Approve mode lets the user switch steps off before the run starts. */
  mode: "approve" | "live"
  /** Off because the user said so, or because a dependency is off. */
  disabled: boolean
  /** Disabled by cascade rather than directly — explains itself differently. */
  cascaded: boolean
  onToggle?: (key: string) => void
}

const STATUS_STYLE: Record<
  AgentRunStepStatus,
  { label: string; fg: string; bg: string }
> = {
  PLANNED: { label: "Planned", fg: "var(--vq-ink-2)", bg: "color-mix(in srgb, var(--foreground) 6%, transparent)" },
  DISABLED: { label: "Skipped", fg: "var(--vq-ink-3)", bg: "color-mix(in srgb, var(--foreground) 5%, transparent)" },
  BLOCKED: { label: "Blocked", fg: "color-mix(in srgb, var(--vq-yellow) 65%, black)", bg: "color-mix(in srgb, var(--vq-yellow) 16%, transparent)" },
  READY: { label: "Ready", fg: "var(--vq-ink-2)", bg: "color-mix(in srgb, var(--foreground) 6%, transparent)" },
  RUNNING: { label: "Running", fg: "color-mix(in srgb, var(--vq-blue) 55%, black)", bg: "color-mix(in srgb, var(--vq-blue) 22%, transparent)" },
  AWAITING_APPROVAL: { label: "Needs you", fg: "color-mix(in srgb, var(--vq-yellow) 65%, black)", bg: "color-mix(in srgb, var(--vq-yellow) 22%, transparent)" },
  SUCCEEDED: { label: "Done", fg: "color-mix(in srgb, var(--vq-green) 60%, black)", bg: "color-mix(in srgb, var(--vq-green) 18%, transparent)" },
  FAILED: { label: "Failed", fg: "color-mix(in srgb, var(--vq-red) 55%, black)", bg: "color-mix(in srgb, var(--vq-red) 18%, transparent)" },
  SKIPPED: { label: "Not run", fg: "var(--vq-ink-3)", bg: "color-mix(in srgb, var(--foreground) 5%, transparent)" },
}

const StatusIcon = ({ status }: { status: AgentRunStepStatus }) => {
  const props = { size: 11, strokeWidth: 2.5 }
  switch (status) {
    case "RUNNING":
      return <Loader2 {...props} className="animate-spin" />
    case "SUCCEEDED":
      return <Check {...props} />
    case "FAILED":
      return <X {...props} />
    case "AWAITING_APPROVAL":
      return <Clock {...props} />
    case "BLOCKED":
      return <Ban {...props} />
    case "DISABLED":
    case "SKIPPED":
      return <MinusCircle {...props} />
    default:
      return null
  }
}

export function RunStepNode({ data }: NodeProps) {
  const { step, agentColor: fallbackColor, mode, disabled, cascaded, onToggle } =
    data as RunStepNodeData
  // Each step is coloured for the employee who does it, not for whoever led the
  // run — a team plan is several people's work and should read that way.
  const agentColor = agentColorFor(step.agent, fallbackColor)

  const status = disabled ? "DISABLED" : step.status
  const style = STATUS_STYLE[status]
  const integration = step.integrationSlug
    ? getIntegrationBySlug(step.integrationSlug)
    : undefined
  const canToggle = mode === "approve" && !cascaded

  return (
    <div
      onClick={() => canToggle && onToggle?.(step.key)}
      title={
        cascaded
          ? "Off because a step it depends on is off"
          : canToggle
            ? disabled
              ? "Click to include this step"
              : "Click to skip this step"
            : step.intent
      }
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        boxSizing: "border-box",
        padding: "10px 12px",
        borderRadius: 12,
        background: "var(--vq-surface)",
        border: `1px solid ${disabled ? "var(--vq-line)" : "var(--vq-line-2)"}`,
        borderLeft: `3px solid ${disabled ? "color-mix(in srgb, var(--foreground) 14%, transparent)" : agentColor}`,
        borderStyle: disabled ? "dashed" : "solid",
        opacity: disabled ? 0.45 : 1,
        cursor: canToggle ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 5,
        transition: "opacity 150ms ease, border-color 150ms ease",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 9.5,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: disabled ? "var(--vq-ink-3)" : `color-mix(in srgb, ${agentColor} 75%, var(--foreground))`,
            fontWeight: 600,
          }}
        >
          {step.agent.toLowerCase()}
        </span>
        {step.isWrite && (
          <span
            title={step.expectedScope ?? "Changes something outside Veqiro"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "color-mix(in srgb, var(--vq-yellow) 65%, black)",
              background: "color-mix(in srgb, var(--vq-yellow) 20%, transparent)",
              borderRadius: 4,
              padding: "1px 5px",
            }}
          >
            <PenLine size={9} strokeWidth={2.5} />
            writes
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10,
            fontWeight: 500,
            color: style.fg,
            background: style.bg,
            borderRadius: 999,
            padding: "2px 7px",
          }}
        >
          <StatusIcon status={status} />
          {style.label}
        </span>
      </div>

      <div
        style={{
          fontSize: 13,
          fontWeight: 550,
          lineHeight: 1.3,
          color: "var(--foreground)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {step.title}
      </div>

      <div
        style={{
          marginTop: "auto",
          fontSize: 11,
          color: "var(--vq-ink-3)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {step.errorMessage
          ? step.errorMessage
          : integration?.name ?? (step.integrationSlug || "no integration")}
      </div>
    </div>
  )
}
