"use client"

import { useId, useEffect, useState } from "react"
import { useMediaViewer } from "./MediaViewer"

export function ChatImage({
  src,
  alt = "",
  maxWidth = 320,
  borderRadius = 10,
  className,
}: {
  src: string
  alt?: string
  maxWidth?: number
  borderRadius?: number
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const id = useId()
  const viewer = useMediaViewer()

  useEffect(() => {
    if (!viewer || !src || error) return
    viewer.register(id, src)
    return () => viewer.unregister(id)
  }, [viewer, id, src, error])

  return (
    <div style={{ maxWidth, width: "100%", borderRadius, overflow: "hidden", position: "relative" }}>
      {!loaded && !error && (
        <div
          className="animate-pulse"
          style={{ width: "100%", minHeight: 180, background: "#D8D8D8", borderRadius }}
        />
      )}
      {!error && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => { setError(true); setLoaded(false) }}
          onClick={() => loaded && viewer?.open(src)}
          style={{
            display: loaded ? "block" : "none",
            width: "100%",
            height: "auto",
            borderRadius,
            cursor: loaded && viewer ? "zoom-in" : "default",
          }}
          className={className}
        />
      )}
      {error && (
        <div
          style={{
            minHeight: 80,
            background: "#F0F0F0",
            borderRadius,
            display: "grid",
            placeItems: "center",
            color: "#999",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
          }}
        >
          image unavailable
        </div>
      )}
    </div>
  )
}
