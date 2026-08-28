"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Check, X, Loader2, Clock, PenLine, Ban, MinusCircle } from "lucide-react"
import { getIntegrationBySlug } from "@repo/integrations-catalog"
import type { AgentRunStep, AgentRunStepStatus } from "@/lib/types/runs"
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
  PLANNED: { label: "Planned", fg: "#56514A", bg: "rgba(20,18,14,0.06)" },
  DISABLED: { label: "Skipped", fg: "#8B857A", bg: "rgba(20,18,14,0.05)" },
  BLOCKED: { label: "Blocked", fg: "#7A5A00", bg: "rgba(245,197,24,0.16)" },
  READY: { label: "Ready", fg: "#56514A", bg: "rgba(20,18,14,0.06)" },
  RUNNING: { label: "Running", fg: "#0E5C74", bg: "rgba(111,205,232,0.22)" },
  AWAITING_APPROVAL: { label: "Needs you", fg: "#7A5A00", bg: "rgba(245,197,24,0.22)" },
  SUCCEEDED: { label: "Done", fg: "#0E5C3F", bg: "rgba(29,188,135,0.18)" },
  FAILED: { label: "Failed", fg: "#B91C1C", bg: "rgba(240,100,100,0.18)" },
  SKIPPED: { label: "Not run", fg: "#8B857A", bg: "rgba(20,18,14,0.05)" },
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
  const { step, agentColor, mode, disabled, cascaded, onToggle } =
    data as RunStepNodeData

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
        background: "#FBF7EF",
        border: `1px solid ${disabled ? "rgba(20,18,14,0.10)" : "rgba(20,18,14,0.17)"}`,
        borderLeft: `3px solid ${disabled ? "rgba(20,18,14,0.14)" : agentColor}`,
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
            color: "#8B857A",
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
              color: "#7A5A00",
              background: "rgba(245,197,24,0.20)",
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
          color: "#14120E",
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
          color: "#8B857A",
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
