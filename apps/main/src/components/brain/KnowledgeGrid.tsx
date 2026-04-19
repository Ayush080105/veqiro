"use client"

import { Brain } from "lucide-react"

import type { KnowledgeItem } from "@/lib/types"
import { KnowledgeCard } from "@/components/brain/KnowledgeCard"
import { FONT } from "@/components/veqiro/shared"

interface KnowledgeGridProps {
  items: KnowledgeItem[]
  onDelete: (id: string) => void
}

export function KnowledgeGrid({ items, onDelete }: KnowledgeGridProps) {
  if (items.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "56px 20px",
          textAlign: "center",
          background: "#FFF9ED",
          border: "2.5px dashed #111",
          borderRadius: 14,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "#F5C518",
            border: "2.5px solid #111",
            boxShadow: "4px 4px 0 #111",
            display: "grid",
            placeItems: "center",
            transform: "rotate(-4deg)",
            color: "#111",
          }}
        >
          <Brain className="size-7" />
        </div>
        <div>
          <p
            style={{
              fontFamily: FONT.display,
              fontSize: 28,
              color: "#111",
              margin: 0,
              letterSpacing: -0.5,
            }}
          >
            no knowledge yet
          </p>
          <p
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#555",
              marginTop: 4,
            }}
          >
            // add your first piece to get started
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 16,
      }}
    >
      {items.map((item) => (
        <KnowledgeCard key={item.id} item={item} onDelete={onDelete} />
      ))}
    </div>
  )
}
