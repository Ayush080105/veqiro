"use client"

import { useMemo } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  type Edge,
  type Node,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import type { AgentRunStep } from "@/lib/types/runs"
import { RunStepNode, type RunStepNodeData } from "./RunStepNode"
import { layoutRun, layoutBounds, NODE_HEIGHT } from "./runLayout"

const nodeTypes = { step: RunStepNode }

export interface RunGraphProps {
  steps: AgentRunStep[]
  agentColor: string
  mode: "approve" | "live"
  disabledKeys: Set<string>
  cascadedKeys: Set<string>
  onToggle?: (key: string) => void
}

export function RunGraph({
  steps,
  agentColor,
  mode,
  disabledKeys,
  cascadedKeys,
  onToggle,
}: RunGraphProps) {
  const laidOut = useMemo(() => layoutRun(steps), [steps])

  const nodes = useMemo<Node<RunStepNodeData>[]>(
    () =>
      laidOut.map(({ step, x, y }) => ({
        id: step.key,
        type: "step",
        position: { x, y },
        data: {
          step,
          agentColor,
          mode,
          disabled: disabledKeys.has(step.key) || cascadedKeys.has(step.key),
          cascaded: cascadedKeys.has(step.key),
          onToggle,
        },
        draggable: false,
        selectable: false,
      })),
    [laidOut, agentColor, mode, disabledKeys, cascadedKeys, onToggle],
  )

  const edges = useMemo<Edge[]>(() => {
    const known = new Set(steps.map((s) => s.key))
    return steps.flatMap((s) =>
      s.dependsOn
        .filter((dep) => known.has(dep))
        .map((dep) => {
          const dimmed =
            disabledKeys.has(dep) ||
            cascadedKeys.has(dep) ||
            disabledKeys.has(s.key) ||
            cascadedKeys.has(s.key)
          return {
            id: `${dep}->${s.key}`,
            source: dep,
            target: s.key,
            animated: !dimmed && s.status === "RUNNING",
            style: {
              stroke: dimmed ? "rgba(20,18,14,0.12)" : "rgba(20,18,14,0.28)",
              strokeWidth: 1.5,
              strokeDasharray: dimmed ? "4 4" : undefined,
            },
          }
        }),
    )
  }, [steps, disabledKeys, cascadedKeys])

  const { height } = layoutBounds(laidOut)
  // Reserve real height rather than measuring: the panel sits inside a chat
  // bubble, so a collapsing canvas would make the whole thread jump.
  const canvasHeight = Math.max(height + 32, NODE_HEIGHT + 64)

  return (
    <div
      style={{
        height: Math.min(canvasHeight, 420),
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(20,18,14,0.10)",
        background: "#F5EEE0",
      }}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.16, maxZoom: 1 }}
          // Read-only canvas: the graph is a plan, not a diagram editor.
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={18}
            size={1}
            color="rgba(20,18,14,0.10)"
          />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
