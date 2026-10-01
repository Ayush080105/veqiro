import assert from "node:assert/strict"
import test from "node:test"

import { workspaceRedirectTarget } from "./redirect"

test("stays on the chat page when the flag is off", () => {
  assert.equal(
    workspaceRedirectTarget({ agent: "lex", enabled: false }),
    null,
    "the flag being off is the rollback, and it has to hold even for a migrated agent",
  )
})

test("stays on the chat page for an agent that has not been migrated", () => {
  // Every shipped agent is migrated now, so the rollback case — one agent taken
  // out of WORKSPACE_MIGRATED — is exercised by injecting a smaller set.
  assert.equal(
    workspaceRedirectTarget({ agent: "maya", enabled: true, migrated: new Set(["lex"]) }),
    null,
  )
})

test("a migrated agent still redirects when the set names it", () => {
  assert.equal(
    workspaceRedirectTarget({ agent: "maya", enabled: true, migrated: new Set(["maya"]) }),
    "/workspace/maya/overview",
  )
})

test("sends a migrated agent to its overview", () => {
  assert.equal(
    workspaceRedirectTarget({ agent: "lex", enabled: true }),
    "/workspace/lex/overview",
  )
})

test("an unknown agent is never redirected", () => {
  assert.equal(workspaceRedirectTarget({ agent: "nope", enabled: true }), null)
})

test("forwards an ?action= deep link to chat, not overview", () => {
  // The whole point: someone clicked "analyze contract" from somewhere else,
  // and landing them on an overview would drop the task they were mid-way
  // through.
  assert.equal(
    workspaceRedirectTarget({
      agent: "lex",
      enabled: true,
      searchParams: { action: "lex:analyze-contract" },
    }),
    "/workspace/lex/chat?action=lex%3Aanalyze-contract",
  )
})

test("forwards a prefill payload alongside the action", () => {
  const target = workspaceRedirectTarget({
    agent: "lex",
    enabled: true,
    searchParams: {
      action: "lex:draft-reply",
      prefill: JSON.stringify({ sourceRowId: "abc" }),
    },
  })
  assert.ok(target)
  const query = new URLSearchParams(target.split("?")[1])
  assert.equal(query.get("action"), "lex:draft-reply")
  assert.deepEqual(JSON.parse(query.get("prefill")!), { sourceRowId: "abc" })
})

test("takes the first value of a repeated parameter rather than dropping it", () => {
  assert.equal(
    workspaceRedirectTarget({
      agent: "lex",
      enabled: true,
      searchParams: { action: ["lex:explain", "lex:other"] },
    }),
    "/workspace/lex/chat?action=lex%3Aexplain",
  )
})

test("ignores an empty repeated parameter", () => {
  assert.equal(
    workspaceRedirectTarget({ agent: "lex", enabled: true, searchParams: { stray: [] } }),
    "/workspace/lex/overview",
  )
})
