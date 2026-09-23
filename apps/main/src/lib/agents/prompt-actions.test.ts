import assert from "node:assert/strict"
import test from "node:test"

import {
  PROMPT_ACTIONS,
  PROMPT_MAX_LENGTH,
  isPromptAction,
  validatePromptAction,
  type PromptActionId,
} from "./prompt-actions"

const defaults = (id: PromptActionId) =>
  Object.fromEntries(PROMPT_ACTIONS[id].fields.map((f) => [f.name, f.defaultValue ?? ""]))

test("refuses to send with a required field empty", () => {
  const spec = PROMPT_ACTIONS["vega:compose-email"]
  assert.match(validatePromptAction(spec, defaults("vega:compose-email")) ?? "", /required/)
})

test("never lets a write run unattended", () => {
  assert.match(
    PROMPT_ACTIONS["vega:compose-email"].build({ to: "a@b.co", instructions: "hi" }),
    /Do not send it/,
  )
  assert.match(
    PROMPT_ACTIONS["vega:draft-reply"].build({ email: "x", tone: "friendly" }),
    /Do not send it/,
  )
  assert.match(
    PROMPT_ACTIONS["vega:create-event"].build({ description: "sync" }),
    /only after I confirm/,
  )
})

test("read-only actions say so", () => {
  for (const id of ["vega:process-inbox", "vega:calendar-summary"] as const) {
    assert.match(PROMPT_ACTIONS[id].build(defaults(id)), /Only read|only read/i)
  }
})

test("catches a request longer than the composer accepts", () => {
  const spec = PROMPT_ACTIONS["vega:compose-email"]
  assert.match(
    validatePromptAction(spec, { to: "a@b.co", instructions: "x".repeat(PROMPT_MAX_LENGTH) }) ?? "",
    /too long/,
  )
  assert.equal(validatePromptAction(spec, { to: "a@b.co", instructions: "short" }), null)
})

test("recognises only its own ids", () => {
  assert.equal(isPromptAction("vega:compose-email"), true)
  assert.equal(isPromptAction("vega:daily-briefing"), false)
  assert.equal(isPromptAction(null), false)
})
