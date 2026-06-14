"use client"

import * as React from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

// ── Context ───────────────────────────────────────────────────────────────────

interface MediaViewerContextValue {
  register: (id: string, src: string) => void
  unregister: (id: string) => void
  open: (src: string) => void
}

export const MediaViewerContext = React.createContext<MediaViewerContextValue | null>(null)

export function useMediaViewer() {
  return React.useContext(MediaViewerContext)
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface ViewerState {
  open: boolean
  images: string[]
  index: number
}

export function MediaViewerProvider({ children }: { children: React.ReactNode }) {
  const registryRef = React.useRef<Map<string, string>>(new Map())
  const orderRef = React.useRef<string[]>([])

  const [state, setState] = React.useState<ViewerState>({ open: false, images: [], index: 0 })

  const register = React.useCallback((id: string, src: string) => {
    if (!registryRef.current.has(id)) orderRef.current.push(id)
    registryRef.current.set(id, src)
  }, [])

  const unregister = React.useCallback((id: string) => {
    registryRef.current.delete(id)
    orderRef.current = orderRef.current.filter((i) => i !== id)
  }, [])

  const open = React.useCallback((src: string) => {
    const images = orderRef.current
      .map((id) => registryRef.current.get(id))
      .filter((s): s is string => !!s)
    const index = images.indexOf(src)
    setState({ open: true, images, index: index >= 0 ? index : 0 })
  }, [])

  const close = React.useCallback(() => setState((s) => ({ ...s, open: false })), [])

  const go = React.useCallback(
    (delta: number) =>
      setState((s) => ({
        ...s,
        index: Math.max(0, Math.min(s.images.length - 1, s.index + delta)),
      })),
    []
  )

  React.useEffect(() => {
    if (!state.open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
      if (e.key === "ArrowLeft") go(-1)
      if (e.key === "ArrowRight") go(1)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [state.open, close, go])

  const ctx = React.useMemo(() => ({ register, unregister, open }), [register, unregister, open])

  return (
    <MediaViewerContext.Provider value={ctx}>
      {children}
      {state.open && (
        <MediaViewerOverlay
          images={state.images}
          index={state.index}
          onClose={close}
          onGo={go}
          onSelect={(i) => setState((s) => ({ ...s, index: i }))}
        />
      )}
    </MediaViewerContext.Provider>
  )
}

// ── Overlay ───────────────────────────────────────────────────────────────────

function CircleBtn({
  onClick,
  children,
  label,
  style,
}: {
  onClick: () => void
  children: React.ReactNode
  label: string
  style?: React.CSSProperties
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.15)",
        border: "none",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        color: "#fff",
        flexShrink: 0,
        backdropFilter: "blur(4px)",
        transition: "background 150ms",
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.28)" }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)" }}
    >
      {children}
    </button>
  )
}

function MediaViewerOverlay({
  images,
  index,
  onClose,
  onGo,
  onSelect,
}: {
  images: string[]
  index: number
  onClose: () => void
  onGo: (delta: number) => void
  onSelect: (i: number) => void
}) {
  const thumbRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  // Auto-scroll active thumb into view
  React.useEffect(() => {
    thumbRefs.current[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
  }, [index])

  const hasPrev = index > 0
  const hasNext = index < images.length - 1
  const src = images[index]

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.95)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
      }}
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          flexShrink: 0,
        }}
      >
        <CircleBtn onClick={onClose} label="Close">
          <X size={18} />
        </CircleBtn>
        {images.length > 1 && (
          <span
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 13,
              fontFamily: "var(--font-mono, monospace)",
              letterSpacing: "0.05em",
            }}
          >
            {index + 1} / {images.length}
          </span>
        )}
        <div style={{ width: 40 }} />
      </div>

      {/* Main image area */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "0 12px",
          position: "relative",
        }}
      >
        {/* Prev arrow */}
        <div style={{ opacity: hasPrev ? 1 : 0, pointerEvents: hasPrev ? "auto" : "none" }}>
          <CircleBtn onClick={() => onGo(-1)} label="Previous image">
            <ChevronLeft size={22} />
          </CircleBtn>
        </div>

        {/* Image */}
        {src && (
          <img
            key={src}
            src={src}
            alt={`Media ${index + 1}`}
            style={{
              maxHeight: "72vh",
              maxWidth: "calc(100vw - 140px)",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              borderRadius: 8,
              userSelect: "none",
            }}
          />
        )}

        {/* Next arrow */}
        <div style={{ opacity: hasNext ? 1 : 0, pointerEvents: hasNext ? "auto" : "none" }}>
          <CircleBtn onClick={() => onGo(1)} label="Next image">
            <ChevronRight size={22} />
          </CircleBtn>
        </div>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            padding: "12px 16px 16px",
            flexShrink: 0,
            scrollbarWidth: "none",
          }}
        >
          {images.map((imgSrc, i) => (
            <button
              key={imgSrc + i}
              ref={(el) => { thumbRefs.current[i] = el }}
              type="button"
              onClick={() => onSelect(i)}
              style={{
                flexShrink: 0,
                width: 60,
                height: 60,
                padding: 0,
                border: i === index ? "2.5px solid #fff" : "2.5px solid transparent",
                borderRadius: 8,
                overflow: "hidden",
                cursor: "pointer",
                opacity: i === index ? 1 : 0.5,
                transition: "opacity 150ms, border-color 150ms",
                background: "rgba(255,255,255,0.08)",
              }}
            >
              <img
                src={imgSrc}
                alt={`Thumbnail ${i + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
