"use client"

import { FONT } from "@/lib/fonts"

interface CharCountProps {
  value: string
  min?: number
  max?: number
  hint?: string
}

// Live character counter shown beneath a textarea. Renders below-min state in
// amber and above-max state in red. Stays out of the way once the field is in
// the green band.
export function CharCount({ value, min, max, hint }: CharCountProps) {
  const len = value.trim().length
  const tooShort = typeof min === "number" && len < min
  const tooLong = typeof max === "number" && len > max
  const fine = !tooShort && !tooLong

  const color = tooLong ? "#8B1E1E" : tooShort ? "#7A5A00" : "#1DBC87"

  let label: string
  if (tooLong && typeof max === "number") {
    label = `${len} / ${max} max — trim`
  } else if (typeof min === "number" && typeof max === "number") {
    label = `${len} chars (${min} min · ${max} max)`
  } else if (typeof min === "number") {
    label = `${len} / ${min} min`
  } else if (typeof max === "number") {
    label = `${len} / ${max} max`
  } else {
    label = `${len} chars`
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: FONT.mono,
        fontSize: 11,
        letterSpacing: 0.5,
        color,
        marginTop: 6,
      }}
    >
      <span>{label}</span>
      {hint && !fine && (
        <span style={{ color: "#555", fontSize: 10 }}>{hint}</span>
      )}
    </div>
  )
}
