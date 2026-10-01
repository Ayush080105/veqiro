import assert from "node:assert/strict"
import test from "node:test"

import {
  buildMemoryGraph,
  extractEntities,
  settleLayout,
  type GraphInputItem,
} from "./memory-graph"

const item = (id: string, content: string, over: Partial<GraphInputItem> = {}): GraphInputItem => ({
  id,
  agent: "lex",
  kind: "fact",
  content,
  origin: "AGENT",
  confirmed: false,
  ...over,
})

test("ignores the sentence-initial word and common capitalised words", () => {
  assert.deepEqual(extractEntities("Acme signs with Stripe every March"), ["Stripe"])
})

test("a name in two facts becomes a node linking them; a name in one does not", () => {
  const g = buildMemoryGraph("Lex", [
    item("1", "Contracts with Acme renew in Q1"),
    item("2", "Legal review of Acme needs Delaware law"),
    item("3", "Talked to Globex once"),
  ])
  const entities = g.nodes.filter((n) => n.type === "entity").map((n) => n.label)
  assert.deepEqual(entities, ["Acme"])
  assert.equal(g.links.filter((l) => l.kind === "entity").length, 2)
})

test("company-wide facts hang off Company, agent facts off their kind", () => {
  const g = buildMemoryGraph("Lex", [
    item("1", "Plain English please", { agent: null, kind: "preference" }),
    item("2", "Governs under Delaware law"),
  ])
  const parent = (id: string) => g.links.find((l) => l.target === `item:${id}`)?.source
  assert.equal(parent("1"), "company")
  assert.equal(parent("2"), "kind:fact")
})

test("caps the number of facts and says so", () => {
  const many = Array.from({ length: 150 }, (_, i) => item(String(i), `fact number ${i}`))
  const g = buildMemoryGraph("Lex", many)
  assert.equal(g.nodes.filter((n) => n.type === "fact").length, 120)
  assert.equal(g.truncated, true)
})

test("layout settles to finite, separated positions and keeps the hub at the centre", () => {
  const g = buildMemoryGraph(
    "Lex",
    Array.from({ length: 40 }, (_, i) => item(String(i), `Fact ${i} about Acme and Stripe`)),
  )
  settleLayout(g.nodes, g.links)
  for (const n of g.nodes) {
    assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), `${n.id} went non-finite`)
  }
  const hub = g.nodes.find((n) => n.type === "hub")!
  assert.equal(hub.x, 0)
  assert.equal(hub.y, 0)
  const facts = g.nodes.filter((n) => n.type === "fact")
  let overlaps = 0
  for (let i = 0; i < facts.length; i++)
    for (let j = i + 1; j < facts.length; j++)
      if (Math.hypot(facts[i].x - facts[j].x, facts[i].y - facts[j].y) < facts[i].r + facts[j].r) overlaps++
  assert.ok(overlaps <= 2, `${overlaps} fact bubbles overlap`)
})

test("an empty memory is just the hub", () => {
  const g = buildMemoryGraph("Lex", [])
  assert.equal(g.nodes.length, 1)
  assert.equal(g.links.length, 0)
})
