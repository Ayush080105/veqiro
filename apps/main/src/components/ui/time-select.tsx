"use client"

import React from "react"

export function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hStr, mStr] = value.split(":")
  const h = Number.isFinite(Number(hStr)) ? Math.min(23, Math.max(0, parseInt(hStr, 10))) : 0
  const rawMinute = Number.isFinite(Number(mStr)) ? parseInt(mStr, 10) : 0
  const m = Math.min(55, Math.max(0, Math.floor(rawMinute / 5) * 5))
  const pad = (n: number) => String(n).padStart(2, "0")
  const sel: React.CSSProperties = {
    appearance: "none",
    padding: "5px 10px",
    border: "1.5px solid #111",
    borderRadius: 6,
    fontSize: 13,
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    background: "#fff",
    outline: "none",
    cursor: "pointer",
    textAlign: "center",
    minWidth: 48,
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <select value={h} onChange={(e) => onChange(`${pad(Number(e.target.value))}:${pad(m)}`)} style={sel}>
        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{pad(i)}</option>)}
      </select>
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "#111" }}>:</span>
      <select value={m} onChange={(e) => onChange(`${pad(h)}:${pad(Number(e.target.value))}`)} style={sel}>
        {Array.from({ length: 12 }, (_, i) => <option key={i} value={i * 5}>{pad(i * 5)}</option>)}
      </select>
    </div>
  )
}
