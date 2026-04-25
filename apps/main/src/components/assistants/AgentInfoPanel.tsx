"use client"

import { useEffect } from "react"
import { X } from "lucide-react"

import { CHARACTER_COMPONENTS } from "@/components/veqiro/characters"
import { FONT } from "@/components/veqiro/shared"
import type { AgentConfig, BrandKit } from "@/lib/types"

function ContextBlock({ kit }: { kit: BrandKit | null }) {
  if (!kit || !kit.companyName) return null
  const swatches = [
    kit.brandColors?.primary,
    kit.brandColors?.secondary,
    kit.brandColors?.accent,
  ].filter(Boolean) as string[]

  const bits: { k: string; v: string }[] = []
  if (kit.companyName) bits.push({ k: "brand", v: kit.companyName })
  if (kit.industry) bits.push({ k: "industry", v: kit.industry })
  if (kit.brandVoice) bits.push({ k: "voice", v: kit.brandVoice })

  return (
    <div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#555",
          marginBottom: 8,
        }}
      >
        context
      </div>
      <div
        style={{
          background: "#fff",
          border: "2px dashed #111",
          borderRadius: 10,
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {bits.map((b) => (
          <div key={b.k} style={{ fontFamily: FONT.mono, fontSize: 11, color: "#111" }}>
            <span style={{ opacity: 0.5 }}>{b.k}: </span>
            <span style={{ fontWeight: 600 }}>{b.v}</span>
          </div>
        ))}
        {swatches.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "#555",
              }}
            >
              palette
            </span>
            {swatches.map((c, i) => (
              <span
                key={i}
                title={c}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: c,
                  border: "1.5px solid #111",
                  display: "inline-block",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AgentInfoPanel({
  agent,
  kit,
  open,
  onClose,
}: {
  agent: AgentConfig
  kit: BrandKit | null
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const Portrait = CHARACTER_COMPONENTS[agent.id]

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.25)",
          zIndex: 40,
        }}
      />
      <aside
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 320,
          background: "#FFF9ED",
          borderLeft: "3px solid #111",
          padding: "20px 18px",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          zIndex: 41,
          boxShadow: "-6px 0 0 #111",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close info"
            style={{
              background: "#fff",
              border: "2px solid #111",
              borderRadius: 999,
              padding: 6,
              cursor: "pointer",
              boxShadow: "2px 2px 0 #111",
              display: "grid",
              placeItems: "center",
            }}
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          style={{
            background: agent.color,
            border: "3px solid #111",
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: "6px 6px 0 #111",
            transform: "rotate(-1.5deg)",
          }}
        >
          {Portrait ? <Portrait size="100%" /> : null}
        </div>

        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#555",
            }}
          >
            {agent.role}
          </div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 44,
              lineHeight: 1,
              color: "#111",
              letterSpacing: -1,
              marginTop: 2,
            }}
          >
            {agent.name.toLowerCase()}
          </div>
        </div>

        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 14,
            lineHeight: 1.5,
            color: "#333",
            margin: 0,
            fontStyle: "italic",
          }}
        >
          &ldquo;{agent.tag}&rdquo;
        </p>

        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#555",
              marginBottom: 8,
            }}
          >
            specialties
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {agent.specialties.map((s) => (
              <span
                key={s}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  padding: "4px 10px",
                  background: "#fff",
                  border: "2px solid #111",
                  borderRadius: 999,
                  color: "#111",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#555",
              marginBottom: 8,
            }}
          >
            stats
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {agent.stats.map((s) => (
              <div
                key={s.k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "6px 10px",
                  background: "#fff",
                  border: "2px solid #111",
                  borderRadius: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "#555",
                  }}
                >
                  {s.k}
                </span>
                <span
                  style={{
                    fontFamily: FONT.head,
                    fontSize: 13,
                    color: "#111",
                  }}
                >
                  {s.v}
                </span>
              </div>
            ))}
          </div>
        </div>

        <ContextBlock kit={kit} />
      </aside>
    </>
  )
}
