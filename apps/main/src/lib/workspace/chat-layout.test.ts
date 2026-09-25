import assert from "node:assert/strict"
import test from "node:test"

import {
  DOCK_DEFAULT,
  clampDockWidth,
  dockPlacement,
  escapeClosesDock,
  parseStoredWidth,
  resolveStoredWidth,
} from "./chat-layout"

test("no dock below lg — chat is a page there", () => {
  assert.equal(dockPlacement(375), "none")
  assert.equal(dockPlacement(1023), "none")
})

test("overlay between lg and xl so the module is not squeezed", () => {
  assert.equal(dockPlacement(1024), "overlay")
  assert.equal(dockPlacement(1279), "overlay")
})

test("inline from xl", () => {
  assert.equal(dockPlacement(1280), "inline")
  assert.equal(dockPlacement(2560), "inline")
})

test("clamp never lets the dock starve the module of 520px next to the 208px rail", () => {
  assert.equal(clampDockWidth(900, 1280), 552) // 1280 - 208 - 520
})

test("clamp enforces the floor and the ceiling", () => {
  assert.equal(clampDockWidth(100, 1920), 320)
  assert.equal(clampDockWidth(5000, 2560), 720)
  assert.equal(clampDockWidth(500, 1920), 500)
})

test("clamp shrinks the ceiling with the viewport", () => {
  assert.equal(clampDockWidth(500, 1100), 372) // 1100 - 208 - 520
})

test("clamp on a viewport too small to honour the module minimum still returns the floor", () => {
  assert.equal(clampDockWidth(500, 1024), 320) // ceiling would be 296, below the floor
})

test("stored width: garbage, empty and out-of-range values are rejected, not thrown on", () => {
  assert.equal(parseStoredWidth(null), null)
  assert.equal(parseStoredWidth(""), null)
  assert.equal(parseStoredWidth("wide"), null)
  assert.equal(parseStoredWidth("NaN"), null)
  assert.equal(parseStoredWidth("-40"), null)
  assert.equal(parseStoredWidth("450"), 450)
  assert.equal(DOCK_DEFAULT, 380)
})

test("a saved width is re-clamped to the current viewport, not trusted", () => {
  assert.equal(resolveStoredWidth("99999", 1920), 720)
  assert.equal(resolveStoredWidth("5", 1920), 320)
  assert.equal(resolveStoredWidth("720", 1280), 552) // saved on a wide monitor, opened on a laptop
  assert.equal(resolveStoredWidth("450", 1920), 450)
})

test("a missing or garbage saved width falls back to the default", () => {
  assert.equal(resolveStoredWidth(null, 1920), DOCK_DEFAULT)
  assert.equal(resolveStoredWidth("wide", 1920), DOCK_DEFAULT)
})

test("Escape closes the floating dock only when nothing else owns the key", () => {
  assert.equal(escapeClosesDock({ defaultPrevented: false, otherLayerOpen: false }), true)
  assert.equal(escapeClosesDock({ defaultPrevented: true, otherLayerOpen: false }), false)
  assert.equal(escapeClosesDock({ defaultPrevented: false, otherLayerOpen: true }), false)
})
