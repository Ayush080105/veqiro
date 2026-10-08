import assert from "node:assert/strict"
import test from "node:test"

import { availableMethods, currentMethod } from "./connect-method-options"

// Tests run from apps/main (`npx tsx --test src/...`).

test("the one-click method is hidden until the server has it set up", () => {
  assert.deepEqual(availableMethods(false), ["service-key", "private-app"])
  assert.ok(!availableMethods(false).includes("oauth"))
})

test("the one-click method is offered first once it is ready", () => {
  assert.deepEqual(availableMethods(true), ["oauth", "service-key", "private-app"])
  assert.equal(currentMethod(null, true), "oauth")
})

test("without it, a Service Key is the default", () => {
  assert.equal(currentMethod(null, false), "service-key")
})

test("a method that is no longer offered is never shown, even if it was picked", () => {
  assert.equal(currentMethod("oauth", false), "service-key")
})

test("a person's pick is kept while it is still offered", () => {
  assert.equal(currentMethod("private-app", true), "private-app")
  assert.equal(currentMethod("private-app", false), "private-app")
})
