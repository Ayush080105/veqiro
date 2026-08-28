import type { AgentRunStep } from "@/lib/types/runs"

/**
 * Layered left-to-right layout for a run's DAG.
 *
 * Hand-rolled rather than dagre/elk on purpose. For a graph capped at 12 nodes
 * the quality difference is invisible, and what actually matters here is
 * *stability*: the panel re-renders on every poll, and a layout engine that
 * shifts nodes between two structurally identical graphs makes the whole thing
 * jitter once a second. Longest-path ranking plus a fixed tie-break on `seq`
 * is deterministic — same graph in, same coordinates out, every time.
 */

export const NODE_WIDTH = 230
export const NODE_HEIGHT = 96
const COLUMN_GAP = 74
const ROW_GAP = 26

export interface LaidOutNode {
  step: AgentRunStep
  x: number
  y: number
  rank: number
}

/**
 * Longest-path ranking: a node sits one column right of its deepest
 * dependency, so every edge points forward and steps that can run in parallel
 * share a column.
 */
const rankNodes = (steps: AgentRunStep[]): Map<string, number> => {
  const byKey = new Map(steps.map((s) => [s.key, s]))
  const ranks = new Map<string, number>()

  const rankOf = (key: string, seen: Set<string>): number => {
    const cached = ranks.get(key)
    if (cached !== undefined) return cached
    // A cycle should be impossible (the planner rejects them) but must not
    // hang the UI if one ever slips through.
    if (seen.has(key)) return 0
    seen.add(key)

    const step = byKey.get(key)
    const deps = (step?.dependsOn ?? []).filter((d) => byKey.has(d))
    const rank = deps.length === 0
      ? 0
      : Math.max(...deps.map((d) => rankOf(d, seen))) + 1

    seen.delete(key)
    ranks.set(key, rank)
    return rank
  }

  for (const s of steps) rankOf(s.key, new Set())
  return ranks
}

export const layoutRun = (steps: AgentRunStep[]): LaidOutNode[] => {
  if (steps.length === 0) return []

  const ranks = rankNodes(steps)
  const columns = new Map<number, AgentRunStep[]>()
  for (const s of steps) {
    const r = ranks.get(s.key) ?? 0
    columns.set(r, [...(columns.get(r) ?? []), s])
  }

  const out: LaidOutNode[] = []
  const tallest = Math.max(...[...columns.values()].map((c) => c.length))

  for (const [rank, columnSteps] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    // Stable tie-break inside a column — planner order, never insertion order.
    const ordered = [...columnSteps].sort((a, b) => a.seq - b.seq)
    // Centre shorter columns against the tallest so the graph reads level.
    const offset = ((tallest - ordered.length) * (NODE_HEIGHT + ROW_GAP)) / 2
    ordered.forEach((step, i) => {
      out.push({
        step,
        rank,
        x: rank * (NODE_WIDTH + COLUMN_GAP),
        y: offset + i * (NODE_HEIGHT + ROW_GAP),
      })
    })
  }

  return out
}

/** Canvas size, so the container can reserve height without measuring. */
export const layoutBounds = (nodes: LaidOutNode[]) => ({
  width: nodes.length ? Math.max(...nodes.map((n) => n.x)) + NODE_WIDTH : 0,
  height: nodes.length ? Math.max(...nodes.map((n) => n.y)) + NODE_HEIGHT : 0,
})
