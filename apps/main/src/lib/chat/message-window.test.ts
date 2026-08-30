import assert from "node:assert/strict"
import test from "node:test"

import type { Message } from "../types"
import { mergeMessageWindow, setMessageDeliveryStatus } from "./message-window"

const message = (overrides: Partial<Message>): Message => ({
  id: "message-1",
  role: "user",
  content: "hello",
  imageUrl: null,
  createdAt: "2026-08-30T12:00:00.000Z",
  ...overrides,
})

test("a stale snapshot cannot erase an optimistic message", () => {
  const optimistic = message({ id: "optimistic-1", deliveryStatus: "sending" })
  const older = message({
    id: "persisted-older",
    content: "older",
    createdAt: "2026-08-30T11:59:00.000Z",
  })

  assert.deepEqual(mergeMessageWindow([optimistic], [older]), [older, optimistic])
})

test("a persisted user row reconciles its failed optimistic equivalent", () => {
  const optimistic = message({ id: "optimistic-1", deliveryStatus: "failed" })
  const persisted = message({
    id: "persisted-1",
    createdAt: "2026-08-30T12:00:01.000Z",
  })

  assert.deepEqual(mergeMessageWindow([optimistic], [persisted]), [
    persisted,
  ])
})

test("server identities update in place instead of duplicating", () => {
  const current = message({ id: "assistant-1", role: "assistant", content: "draft" })
  const persisted = message({ id: "assistant-1", role: "assistant", content: "final" })

  assert.deepEqual(mergeMessageWindow([current], [persisted]), [
    persisted,
  ])
})

test("failed delivery status is retained until retry or reconciliation", () => {
  const optimistic = message({ id: "optimistic-1", deliveryStatus: "sending" })
  const failed = setMessageDeliveryStatus([optimistic], optimistic.id!, "failed")

  assert.equal(failed.length, 1)
  assert.equal(failed[0].deliveryStatus, "failed")
})

test("an explicit window limit retains the newest messages", () => {
  const first = message({ id: "1", createdAt: "2026-08-30T12:00:00.000Z" })
  const second = message({ id: "2", content: "two", createdAt: "2026-08-30T12:01:00.000Z" })
  const third = message({ id: "3", content: "three", createdAt: "2026-08-30T12:02:00.000Z" })

  assert.deepEqual(mergeMessageWindow([first, second], [third], 2).map((item) => item.id), ["2", "3"])
})
