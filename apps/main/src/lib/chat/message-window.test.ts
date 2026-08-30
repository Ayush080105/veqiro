import assert from "node:assert/strict"
import test from "node:test"

import type { Message } from "../types"
import {
  mergeMessageWindow,
  mergeServerSnapshot,
  parseCachedMessageWindow,
  setMessageDeliveryStatus,
} from "./message-window"

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

test("an existing persisted repeat cannot consume a newer optimistic prompt", () => {
  const persisted = message({ id: "persisted-1" })
  const optimistic = message({
    id: "optimistic-1",
    createdAt: "2026-08-30T12:00:05.000Z",
    deliveryStatus: "sending",
  })

  assert.deepEqual(mergeMessageWindow([persisted, optimistic], [persisted]), [
    persisted,
    optimistic,
  ])
})

test("the closest matching local prompt is reconciled when text repeats", () => {
  const first = message({ id: "optimistic-1", createdAt: "2026-08-30T12:00:00.000Z" })
  const second = message({ id: "optimistic-2", createdAt: "2026-08-30T12:00:10.000Z" })
  const persisted = message({ id: "persisted-2", createdAt: "2026-08-30T12:00:09.000Z" })

  assert.deepEqual(mergeMessageWindow([first, second], [persisted]), [first, persisted])
})

test("server identities update in place instead of duplicating", () => {
  const current = message({ id: "assistant-1", role: "assistant", content: "draft" })
  const persisted = message({ id: "assistant-1", role: "assistant", content: "final" })

  assert.deepEqual(mergeMessageWindow([current], [persisted]), [
    persisted,
  ])
})

test("failed delivery status is retained until server reconciliation", () => {
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

test("a bounded window retains an optimistic row despite client clock skew", () => {
  const optimistic = message({
    id: "optimistic-1",
    createdAt: "2026-08-30T11:00:00.000Z",
    deliveryStatus: "sending",
  })
  const persisted = [1, 2, 3].map((minute) =>
    message({
      id: String(minute),
      content: String(minute),
      createdAt: `2026-08-30T12:0${minute}:00.000Z`,
    }),
  )

  assert.deepEqual(
    mergeMessageWindow([optimistic], persisted, 3).map((item) => item.id),
    ["optimistic-1", "2", "3"],
  )
})

test("a latest-page snapshot drops stale cached rows but keeps local sends", () => {
  const stale = message({ id: "stale", content: "deleted" })
  const optimistic = message({
    id: "optimistic-1",
    content: "new",
    createdAt: "2026-08-30T12:01:00.000Z",
    deliveryStatus: "sending",
  })
  const persisted = message({ id: "persisted", content: "current" })

  assert.deepEqual(
    mergeServerSnapshot([stale, optimistic], [persisted], 20),
    [persisted, optimistic],
  )
  assert.deepEqual(mergeServerSnapshot([stale], [], 20), [])
  assert.deepEqual(mergeServerSnapshot([stale, optimistic], [], 20), [optimistic])
})

test("localStorage parsing rejects incompatible data and caps the cache", () => {
  assert.deepEqual(parseCachedMessageWindow('{"not":"an array"}', 20), [])
  assert.deepEqual(parseCachedMessageWindow("not-json", 20), [])

  const first = message({ id: "1" })
  const second = message({ id: "2", deliveryStatus: "failed" })
  assert.deepEqual(parseCachedMessageWindow(JSON.stringify([first, second]), 1), [second])
})
