import assert from "node:assert/strict"
import test from "node:test"

import { orgPlanLabel } from "./org-plan"

const e = (source: "TRIAL" | "AGENT", status: "TRIALING" | "ACTIVE" | "PAST_DUE") => ({
  source,
  status,
})

test("no entitlements means no badge — never a made-up plan", () => {
  assert.equal(orgPlanLabel(undefined), null)
  assert.equal(orgPlanLabel([]), null)
})

test("only trial entitlements read as a trial", () => {
  assert.equal(orgPlanLabel([e("TRIAL", "TRIALING"), e("TRIAL", "TRIALING")]), "Trial")
})

test("any paid, active agent makes the organization paid — even alongside a trial", () => {
  assert.equal(orgPlanLabel([e("AGENT", "ACTIVE")]), "Paid")
  assert.equal(orgPlanLabel([e("TRIAL", "TRIALING"), e("AGENT", "ACTIVE")]), "Paid")
})

test("a failed payment outranks everything, because it needs action", () => {
  assert.equal(orgPlanLabel([e("AGENT", "PAST_DUE"), e("AGENT", "ACTIVE")]), "Past due")
})
