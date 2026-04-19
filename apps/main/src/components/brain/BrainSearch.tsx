"use client"

import { Search, X } from "lucide-react"
import { FONT } from "@/components/veqiro/shared"

interface BrainSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function BrainSearch({
  value,
  onChange,
  placeholder = "Search knowledge…",
}: BrainSearchProps) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        background: "#fff",
        border: "2.5px solid #111",
        borderRadius: 999,
        boxShadow: "3px 3px 0 #111",
        padding: "0 14px 0 40px",
      }}
    >
      <Search
        className="size-4"
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#555",
        }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          height: 40,
          background: "transparent",
          border: "none",
          outline: "none",
          fontFamily: FONT.body,
          fontSize: 14,
          color: "#111",
        }}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          style={{
            background: "transparent",
            border: "none",
            padding: 4,
            color: "#555",
            cursor: "pointer",
          }}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
