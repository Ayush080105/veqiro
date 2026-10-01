import assert from "node:assert/strict"
import test from "node:test"

import { PROMPT_ACTIONS, validatePromptAction } from "./prompt-actions"
import { clip, contractRiskEmail, fitSections, investorUpdateEmail, runwayBoardEmail } from "./vega-handoffs"

// The point of all of this: a handed-over draft must always be sendable as is.
const sendable = (p: { subject: string; instructions: string }) =>
  validatePromptAction(PROMPT_ACTIONS["vega:compose-email"], {
    to: "someone@example.com",
    tone: "professional",
    ...p,
  })

test("clip cuts at a word and marks the cut", () => {
  const out = clip("alpha beta gamma delta epsilon", 18)
  assert.ok(out.endsWith("…"))
  assert.ok(!out.slice(0, -1).endsWith(" "), "no trailing space before the marker")
  assert.ok(out.length <= 18)
  assert.equal(clip("short", 50), "short")
})

test("fitSections drops whole trailing sections rather than halving them", () => {
  const out = fitSections(["first section stays.", "second is also fine.", "x".repeat(500)], 60)
  assert.equal(out, "first section stays. second is also fine.")
})

test("an oversized investor update still produces a sendable form", () => {
  const long = "word ".repeat(400)
  const p = investorUpdateEmail({
    subject_line: "Q3 update",
    executive_summary: long,
    highlights_section: [long, long],
    challenges_section: [long],
    asks_section: [long],
  })
  assert.equal(sendable(p), null)
  assert.match(p.instructions, /^Send my investors this update\./)
  assert.equal(p.subject, "Q3 update")
})

test("a normal investor update keeps its sections", () => {
  const p = investorUpdateEmail({
    subject_line: "Q3 update",
    executive_summary: "Revenue up 18%.",
    highlights_section: ["Signed Acme", "Launched v2"],
    challenges_section: ["Churn in April"],
    asks_section: ["Intros to CFOs"],
  })
  assert.match(p.instructions, /Revenue up 18%/)
  assert.match(p.instructions, /Highlights: Signed Acme; Launched v2\./)
  assert.match(p.instructions, /Where they can help: Intros to CFOs\./)
})

test("runway email carries the numbers and is sendable", () => {
  const p = runwayBoardEmail({
    runwayLabel: "7.5 mo",
    verdict: "amber",
    cash: "₹42L",
    burn: "₹5.6L",
    revenue: "₹2.1L",
    zeroDate: "2027-05-01",
    recommendation: "Cut spend by 15% or raise within 4 months.",
  })
  assert.equal(p.subject, "Runway update: 7.5 mo (amber)")
  assert.match(p.instructions, /₹42L in the bank/)
  assert.match(p.instructions, /2027-05-01/)
  assert.equal(sendable(p), null)
})

test("a profitable company is not given a zero date", () => {
  const p = runwayBoardEmail({
    runwayLabel: "Profitable", verdict: "green", cash: "₹1Cr", burn: "₹0", revenue: "₹9L", zeroDate: "profitable",
  })
  assert.doesNotMatch(p.instructions, /zero date/i)
})

test("contract risk email lists the worst issues and stays sendable", () => {
  const issues = Array.from({ length: 8 }, (_, i) => ({
    title: `Issue ${i + 1} about liability and indemnity`,
    what_it_means: "This clause means you carry unlimited risk if anything goes wrong. ".repeat(4),
  }))
  const p = contractRiskEmail({ documentName: "Acme MSA", headline: "Do not sign yet", critical: 2, high: 3, issues })
  assert.equal(p.subject, "Contract review: Acme MSA — Do not sign yet")
  assert.match(p.instructions, /2 critical, 3 high/)
  assert.match(p.instructions, /1\) Issue 1/)
  assert.equal(sendable(p), null)
})
