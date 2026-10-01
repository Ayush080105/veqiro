"use client"

import { useRef } from "react"

import { DOCK_DEFAULT, DOCK_MAX, DOCK_MIN } from "@/lib/workspace/chat-layout"
import { useDockWidth } from "@/lib/workspace/dock-store"

/**
 * The drag handle on the dock's left edge.
 *
 * Only offered where the dock sits beside the module (xl+). Below that it is a
 * floating panel of fixed comfortable width, and there is nothing to resize.
 *
 * A real separator: keyboard operable (arrows, Home to reset) and announced
 * with its current value, because a drag-only handle excludes anyone not using
 * a mouse. Width is committed (persisted) on release, not on every pointer
 * move.
 */
export function DockResizeHandle() {
  const [width, setLive, commit] = useDockWidth()
  const drag = useRef<{ startX: number; startW: number } | null>(null)

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize chat"
      aria-valuenow={width}
      aria-valuemin={DOCK_MIN}
      aria-valuemax={DOCK_MAX}
      tabIndex={0}
      className="absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize touch-none transition-colors hover:bg-ring/30 focus-visible:bg-ring/50 focus-visible:outline-none xl:block"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { startX: e.clientX, startW: width }
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        // The dock is on the right: dragging left widens it.
        setLive(drag.current.startW + (drag.current.startX - e.clientX))
      }}
      onPointerUp={(e) => {
        if (!drag.current) return
        commit(drag.current.startW + (drag.current.startX - e.clientX))
        drag.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
      onDoubleClick={() => commit(DOCK_DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault()
          commit(width + 24)
        } else if (e.key === "ArrowRight") {
          e.preventDefault()
          commit(width - 24)
        } else if (e.key === "Home") {
          e.preventDefault()
          commit(DOCK_DEFAULT)
        }
      }}
    />
  )
}
