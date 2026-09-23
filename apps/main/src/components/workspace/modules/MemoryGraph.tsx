"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bot, Check, FileUp, User, X } from "lucide-react"

import type { MemoryItem, MemoryOrigin } from "@/lib/api/workspace"
import {
  buildMemoryGraph,
  settleLayout,
  stepLayout,
  type GraphNode,
} from "@/lib/workspace/memory-graph"
import { Button } from "@/components/ui/button"

const ORIGIN: Record<MemoryOrigin, { label: string; Icon: typeof User }> = {
  USER: { label: "You told it this", Icon: User },
  AGENT: { label: "Inferred from a conversation", Icon: Bot },
  IMPORTED: { label: "Read from your data", Icon: FileUp },
}

interface Props {
  agentName: string
  /** The employee's colour, used for its hub and the glow around it. */
  color: string
  items: MemoryItem[]
  busy: boolean
  onConfirm: (id: string) => void
  onRetire: (id: string) => void
}

const HEIGHT = 460
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * The employee's memory as a graph you can drag around.
 *
 * It is a view over the same rows the list shows, so anything you can do here
 * (confirm, forget) is the same call — the list stays underneath because a
 * picture is a poor way to review forty facts one by one and a poor fit for
 * anyone who can't use a pointer.
 */
export function MemoryGraph({ agentName, color, items, busy, onConfirm, onRetire }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [, setFrame] = useState(0)

  const graph = useMemo(() => {
    const g = buildMemoryGraph(
      agentName,
      items.map((i) => ({
        id: i.id,
        agent: i.agent,
        kind: i.kind,
        content: i.content,
        origin: i.origin,
        confirmed: i.confirmed,
      })),
    )
    // No animation to wait for: hand back a layout that is already at rest.
    if (prefersReducedMotion()) settleLayout(g.nodes, g.links)
    return g
  }, [agentName, items])

  // Simulation state lives outside React: 60 setStates a second for a few
  // hundred nodes is exactly what the frame counter below avoids.
  const alphaRef = useRef(1)
  const rafRef = useRef<number | null>(null)
  const dragRef = useRef<{ node: GraphNode; moved: boolean } | null>(null)
  const [cam, setCam] = useState({ x: 0, y: 0, k: 1 })
  const panning = useRef<{ x: number; y: number } | null>(null)

  // The loop schedules itself, so it goes through a ref rather than naming
  // itself inside its own definition.
  const tickRef = useRef<() => void>(() => {})
  const tick = useCallback(() => tickRef.current(), [])
  useEffect(() => {
    tickRef.current = () => {
      stepLayout(graph.nodes, graph.links, alphaRef.current)
      alphaRef.current = Math.max(0.02, alphaRef.current * 0.985)
      setFrame((f) => f + 1)
      // Rest once cool and not being dragged, rather than burning a core forever.
      if (alphaRef.current > 0.025 || dragRef.current) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }
  }, [graph, tick])

  const reheat = useCallback(
    (to = 0.5) => {
      alphaRef.current = Math.max(alphaRef.current, to)
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick)
    },
    [tick],
  )

  useEffect(() => {
    if (prefersReducedMotion()) return
    // Spread most of the way before the first paint so it doesn't open as a knot.
    for (let i = 0; i < 60; i++) stepLayout(graph.nodes, graph.links, 1)
    alphaRef.current = 0.7
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [graph, tick])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const selectedNode = graph.nodes.find((n) => n.id === selected)
  const selectedItem = selectedNode?.itemId
    ? items.find((i) => i.id === selectedNode.itemId)
    : undefined
  // A retired item disappears from `items`, so a selection that pointed at it
  // simply finds no node and shows no detail card.

  const focusId = hovered ?? selected
  const neighbours = useMemo(() => {
    if (!focusId) return null
    const set = new Set<string>([focusId])
    for (const l of graph.links) {
      if (l.source === focusId) set.add(l.target)
      if (l.target === focusId) set.add(l.source)
    }
    return set
  }, [focusId, graph])

  const pt = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    const { x, y, k } = cam
    return {
      x: (e.clientX - rect.left - width / 2 - x) / k,
      y: (e.clientY - rect.top - HEIGHT / 2 - y) / k,
    }
  }

  const { x: px, y: py, k } = cam

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-[var(--vq-r)] border border-border bg-background"
        style={{ height: HEIGHT, touchAction: "none" }}
        onWheel={(e) => {
          const factor = e.deltaY < 0 ? 1.08 : 0.92
          setCam((c) => ({ ...c, k: Math.min(2.2, Math.max(0.5, c.k * factor)) }))
        }}
        onPointerDown={(e) => {
          // Only reaches here for the background; nodes stop propagation.
          panning.current = { x: e.clientX - cam.x, y: e.clientY - cam.y }
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          setSelected(null)
        }}
        onPointerMove={(e) => {
          if (dragRef.current) {
            const p = pt(e)
            dragRef.current.node.x = p.x
            dragRef.current.node.y = p.y
            dragRef.current.moved = true
            reheat(0.35)
          } else if (panning.current) {
            const origin = panning.current
            setCam((c) => ({ ...c, x: e.clientX - origin.x, y: e.clientY - origin.y }))
          }
        }}
        onPointerUp={() => {
          if (dragRef.current) {
            const { node, moved } = dragRef.current
            if (node.type !== "hub") node.fixed = false
            if (!moved) setSelected(node.id)
            dragRef.current = null
          }
          panning.current = null
        }}
      >
        {/* A soft glow behind the hub — the one flourish; everything else is data. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${color} 14%, transparent), transparent 55%)`,
          }}
        />

        <svg
          role="img"
          aria-label={`Graph of what ${agentName} knows: ${items.length} remembered facts`}
          width={width}
          height={HEIGHT}
          className="relative block select-none"
        >
          <g transform={`translate(${width / 2 + px} ${HEIGHT / 2 + py}) scale(${k})`}>
            {graph.links.map((l) => {
              const s = graph.nodes.find((n) => n.id === l.source)
              const t = graph.nodes.find((n) => n.id === l.target)
              if (!s || !t) return null
              const dim = neighbours && !(neighbours.has(l.source) && neighbours.has(l.target))
              return (
                <line
                  key={`${l.source}>${l.target}`}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  strokeOpacity={dim ? 0.06 : l.kind === "entity" ? 0.35 : 0.22}
                  strokeWidth={l.kind === "entity" ? 1.2 : 1}
                  strokeDasharray={l.kind === "entity" ? "3 3" : undefined}
                />
              )
            })}

            {/* The focused node is drawn last so its label sits above its neighbours. */}
            {[...graph.nodes].sort((a, b) => Number(a.id === focusId) - Number(b.id === focusId)).map((n) => {
              const dim = neighbours && !neighbours.has(n.id)
              const isSel = n.id === selected
              const fill =
                n.type === "hub"
                  ? color
                  : n.type === "fact" && n.confirmed
                    ? "var(--primary)"
                    : n.type === "fact"
                      ? "var(--background)"
                      : "var(--muted)"
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x} ${n.y})`}
                  opacity={dim ? 0.25 : 1}
                  style={{ cursor: n.type === "hub" ? "default" : "grab" }}
                  tabIndex={n.type === "fact" ? 0 : -1}
                  onPointerEnter={() => setHovered(n.id)}
                  onPointerLeave={() => setHovered(null)}
                  onFocus={() => n.type === "fact" && setSelected(n.id)}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    ;(e.currentTarget.ownerSVGElement?.parentElement as HTMLElement | null)?.setPointerCapture(
                      e.pointerId,
                    )
                    if (n.type !== "hub") n.fixed = true
                    dragRef.current = { node: n, moved: false }
                    reheat(0.3)
                  }}
                >
                  {isSel && (
                    <circle r={n.r + 6} fill="none" stroke={color} strokeOpacity={0.5} strokeWidth={2} />
                  )}
                  {n.type === "entity" ? (
                    <rect
                      x={-n.r}
                      y={-n.r}
                      width={n.r * 2}
                      height={n.r * 2}
                      rx={4}
                      transform="rotate(45)"
                      fill="var(--card)"
                      stroke={color}
                      strokeWidth={1.5}
                    />
                  ) : (
                    <circle
                      r={n.r}
                      fill={fill}
                      stroke={n.type === "hub" ? "none" : n.type === "fact" ? "var(--primary)" : "var(--border)"}
                      strokeWidth={n.type === "fact" ? 1.5 : 1}
                      // Unconfirmed reads as tentative: dashed, hollow.
                      strokeDasharray={n.type === "fact" && !n.confirmed ? "2.5 2" : undefined}
                    />
                  )}
                  {n.type === "fact" && n.id === focusId && (
                    <text
                      x={n.r + 8}
                      dominantBaseline="central"
                      className="pointer-events-none fill-current"
                      fontSize={12}
                      // A halo in the page colour keeps the words legible over lines.
                      style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 4 }}
                    >
                      {n.label}
                    </text>
                  )}
                  {n.type !== "fact" && (
                    <text
                      y={n.type === "hub" ? 0 : n.r + 13}
                      textAnchor="middle"
                      dominantBaseline={n.type === "hub" ? "central" : "auto"}
                      className="pointer-events-none fill-current font-head"
                      fontSize={n.type === "hub" ? 13 : 11}
                      style={{ fill: n.type === "hub" ? "#fff" : undefined }}
                    >
                      {n.label}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted-foreground">
          Drag to move · scroll to zoom · dashed = not confirmed yet
        </p>
        {graph.truncated && (
          <p className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-muted-foreground">
            Showing the most relevant 120 — the list has them all
          </p>
        )}
      </div>

      {selectedItem && (
        <div className="flex items-start gap-3 rounded-[var(--vq-r)] border border-border bg-card p-3">
          <span
            className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
            title={ORIGIN[selectedItem.origin].label}
          >
            {(() => {
              const { Icon } = ORIGIN[selectedItem.origin]
              return <Icon className="size-3" />
            })()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm">{selectedItem.content}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ORIGIN[selectedItem.origin].label} ·{" "}
              {selectedItem.confirmed ? "confirmed" : "not confirmed yet"}
            </p>
          </div>
          <span className="flex shrink-0 gap-1">
            {!selectedItem.confirmed && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onConfirm(selectedItem.id)}>
                <Check className="size-4" /> Confirm
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onRetire(selectedItem.id)}>
              <X className="size-4" /> Forget
            </Button>
          </span>
        </div>
      )}
    </div>
  )
}
