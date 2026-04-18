"use client"

import { useState, useEffect, useCallback } from "react"
import type { KnowledgeItem, KnowledgeType, AgentSlug } from "@/lib/types"

const STORAGE_KEY = "veqiro_knowledge_items"

function generateId(): string {
  return `ki_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function loadItems(orgId: string): KnowledgeItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${orgId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistItems(orgId: string, items: KnowledgeItem[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(`${STORAGE_KEY}_${orgId}`, JSON.stringify(items))
}

export function useKnowledgeStore(organizationId: string) {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!organizationId) return
    setItems(loadItems(organizationId))
    setLoaded(true)
  }, [organizationId])

  const addItem = useCallback(
    (input: {
      type: KnowledgeType
      title: string
      content: string
      fileName?: string
      fileSize?: number
      agentAccess?: AgentSlug[]
    }) => {
      const now = new Date().toISOString()
      const item: KnowledgeItem = {
        id: generateId(),
        type: input.type,
        title: input.title,
        content: input.content,
        fileName: input.fileName,
        fileSize: input.fileSize,
        agentAccess: input.agentAccess ?? ["maya", "rex", "scout", "sage", "lex", "vega"],
        createdAt: now,
        updatedAt: now,
      }
      setItems((prev) => {
        const next = [item, ...prev]
        persistItems(organizationId, next)
        return next
      })
      return item
    },
    [organizationId]
  )

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.filter((i) => i.id !== id)
        persistItems(organizationId, next)
        return next
      })
    },
    [organizationId]
  )

  const updateItem = useCallback(
    (id: string, updates: Partial<Omit<KnowledgeItem, "id" | "createdAt">>) => {
      setItems((prev) => {
        const next = prev.map((i) =>
          i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i
        )
        persistItems(organizationId, next)
        return next
      })
    },
    [organizationId]
  )

  const searchItems = useCallback(
    (query: string, type?: KnowledgeType) => {
      let filtered = items
      if (type) filtered = filtered.filter((i) => i.type === type)
      if (query.trim()) {
        const q = query.toLowerCase()
        filtered = filtered.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            i.content.toLowerCase().includes(q) ||
            (i.fileName?.toLowerCase().includes(q) ?? false)
        )
      }
      return filtered
    },
    [items]
  )

  return { items, loaded, addItem, removeItem, updateItem, searchItems }
}
