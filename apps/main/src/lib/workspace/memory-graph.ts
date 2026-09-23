/**
 * What an employee knows, as a graph — the model and the physics, with no React.
 *
 * Structure, not decoration: the agent sits at the centre, its facts hang off
 * the kind of thing they are (fact, preference, constraint…), company-wide
 * context hangs off "Company", and a name that turns up in two or more facts
 * becomes a node of its own that ties them together. That last link is the only
 * one derived from the text, and it is deliberately conservative — a wrong edge
 * in a picture that claims to show what an agent knows is worse than a missing
 * one.
 */

export type GraphNodeType = "hub" | "cluster" | "company" | "fact" | "entity"

export interface GraphNode {
  id: string
  type: GraphNodeType
  label: string
  /** Fact nodes only. */
  itemId?: string
  confirmed?: boolean
  origin?: "USER" | "AGENT" | "IMPORTED"
  kind?: string
  /** Node radius in px; also the collision size. */
  r: number
  x: number
  y: number
  vx: number
  vy: number
  /** Pinned in place (the hub, or a node being dragged). */
  fixed?: boolean
}

export interface GraphLink {
  source: string
  target: string
  /** Link rest length. Entity links are looser so they pull without collapsing. */
  length: number
  kind: "structure" | "entity"
}

export interface GraphInputItem {
  id: string
  agent: string | null
  kind: string
  content: string
  origin: "USER" | "AGENT" | "IMPORTED"
  confirmed: boolean
}

const MAX_ITEMS = 120

/** Capitalised words that start sentences or are simply common; never entities. */
const NOT_ENTITIES = new Set(
  (
    "The This That These Those They Their There Then When Where What Which Who Why How " +
    "Keep Use Always Never Prefer Prefers Wants Want Should Must Will Would Could " +
    "User Company Customer Team Our Your Its And But For With From Into Only Also " +
    "Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March " +
    "April May June July August September October November December"
  ).split(" "),
)

const ENTITY = /\b[A-Z][A-Za-z0-9&]{2,}(?:\.[A-Za-z]{2,})?\b/g

/** Distinct entity-like names in a fact, ignoring the sentence-initial word. */
export function extractEntities(content: string): string[] {
  const found = new Set<string>()
  for (const m of content.matchAll(ENTITY)) {
    if (m.index === 0) continue
    if (NOT_ENTITIES.has(m[0])) continue
    found.add(m[0])
  }
  return [...found]
}

const KIND_LABEL: Record<string, string> = {
  fact: "Facts",
  preference: "Preferences",
  constraint: "Constraints",
  decision: "Decisions",
}
const kindLabel = (kind: string) =>
  KIND_LABEL[kind] ?? `${kind.charAt(0).toUpperCase()}${kind.slice(1)}s`

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export interface MemoryGraph {
  nodes: GraphNode[]
  links: GraphLink[]
  /** True when items beyond the cap were left out. */
  truncated: boolean
}

/** Deterministic 0..1 from a string, so a graph lays out the same way twice. */
function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

export function buildMemoryGraph(agentName: string, allItems: GraphInputItem[]): MemoryGraph {
  const items = allItems.slice(0, MAX_ITEMS)
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []

  const node = (n: Omit<GraphNode, "x" | "y" | "vx" | "vy">): GraphNode => {
    // Start on a ring around the centre, angle from the id: stable, and never
    // all at one point (which a force layout cannot escape from).
    const a = hash01(n.id) * Math.PI * 2
    const d = n.type === "hub" ? 0 : 80 + hash01(`${n.id}:d`) * 220
    const full = { ...n, x: Math.cos(a) * d, y: Math.sin(a) * d, vx: 0, vy: 0 }
    nodes.push(full)
    return full
  }

  node({ id: "hub", type: "hub", label: agentName, r: 30, fixed: true })

  const hasCompany = items.some((i) => i.agent === null)
  if (hasCompany) {
    node({ id: "company", type: "company", label: "Company", r: 18 })
    links.push({ source: "hub", target: "company", length: 170, kind: "structure" })
  }

  const clusters = new Set<string>()
  for (const item of items) {
    // Company-wide facts hang off Company; the rest off their kind.
    const parent = item.agent === null ? "company" : `kind:${item.kind}`
    if (item.agent !== null && !clusters.has(item.kind)) {
      clusters.add(item.kind)
      node({ id: parent, type: "cluster", label: kindLabel(item.kind), kind: item.kind, r: 16 })
      links.push({ source: "hub", target: parent, length: 150, kind: "structure" })
    }
    node({
      id: `item:${item.id}`,
      type: "fact",
      label: truncate(item.content, 44),
      itemId: item.id,
      confirmed: item.confirmed,
      origin: item.origin,
      kind: item.kind,
      r: item.confirmed ? 8 : 6.5,
    })
    links.push({ source: parent, target: `item:${item.id}`, length: 95, kind: "structure" })
  }

  // Names shared by two or more facts.
  const byEntity = new Map<string, string[]>()
  for (const item of items) {
    for (const name of extractEntities(item.content)) {
      const list = byEntity.get(name) ?? []
      list.push(`item:${item.id}`)
      byEntity.set(name, list)
    }
  }
  for (const [name, ids] of byEntity) {
    if (ids.length < 2) continue
    const id = `entity:${name}`
    node({ id, type: "entity", label: name, r: 9 + Math.min(ids.length, 5) })
    for (const itemNodeId of ids) {
      links.push({ source: id, target: itemNodeId, length: 130, kind: "entity" })
    }
  }

  return { nodes, links, truncated: allItems.length > MAX_ITEMS }
}

// ─── Physics ─────────────────────────────────────────────────────────────────

const REPULSION = 5200
const SPRING = 0.045
const GRAVITY = 0.024
const DAMPING = 0.82
const MAX_SPEED = 14

/**
 * One tick of a force layout centred on the origin. `alpha` (1 → 0) scales
 * everything, which is what makes it settle instead of jittering forever.
 * O(n²) repulsion is fine at the ≤ ~200 nodes the cap allows.
 */
export function stepLayout(nodes: GraphNode[], links: GraphLink[], alpha: number): void {
  const byId = new Map(nodes.map((n) => [n.id, n]))

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]
      let dx = a.x - b.x
      let dy = a.y - b.y
      let d2 = dx * dx + dy * dy
      if (d2 < 0.01) {
        dx = hash01(a.id + b.id) - 0.5
        dy = hash01(b.id + a.id) - 0.5
        d2 = dx * dx + dy * dy + 0.01
      }
      const d = Math.sqrt(d2)
      // Also keep bubbles from overlapping: stronger push inside touching range.
      const minD = a.r + b.r + 8
      const push = (REPULSION / d2) * alpha + (d < minD ? (minD - d) * 0.08 : 0)
      const fx = (dx / d) * push
      const fy = (dy / d) * push
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }
  }

  for (const l of links) {
    const s = byId.get(l.source)
    const t = byId.get(l.target)
    if (!s || !t) continue
    const dx = t.x - s.x
    const dy = t.y - s.y
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01
    const pull = (d - l.length) * SPRING * (l.kind === "entity" ? 0.5 : 1) * alpha
    const fx = (dx / d) * pull
    const fy = (dy / d) * pull
    s.vx += fx
    s.vy += fy
    t.vx -= fx
    t.vy -= fy
  }

  for (const n of nodes) {
    if (n.fixed) {
      n.vx = 0
      n.vy = 0
      continue
    }
    n.vx = (n.vx - n.x * GRAVITY * alpha) * DAMPING
    n.vy = (n.vy - n.y * GRAVITY * alpha) * DAMPING
    const speed = Math.hypot(n.vx, n.vy)
    if (speed > MAX_SPEED) {
      n.vx = (n.vx / speed) * MAX_SPEED
      n.vy = (n.vy / speed) * MAX_SPEED
    }
    n.x += n.vx
    n.y += n.vy
  }
}

/** Run the layout to rest without animating — reduced motion, tests, first paint. */
export function settleLayout(nodes: GraphNode[], links: GraphLink[], ticks = 320): void {
  for (let i = 0; i < ticks; i++) {
    stepLayout(nodes, links, Math.max(0.02, 1 - i / ticks))
  }
}
