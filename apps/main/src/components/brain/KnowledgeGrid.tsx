"use client"

import { Brain } from "lucide-react"

import type { KnowledgeItem } from "@/lib/types"
import { KnowledgeCard } from "@/components/brain/KnowledgeCard"

interface KnowledgeGridProps {
  items: KnowledgeItem[]
  onDelete: (id: string) => void
}

export function KnowledgeGrid({ items, onDelete }: KnowledgeGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Brain className="size-6 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">No knowledge yet</p>
          <p className="text-xs text-muted-foreground">
            Add your first piece of knowledge to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <KnowledgeCard key={item.id} item={item} onDelete={onDelete} />
      ))}
    </div>
  )
}
