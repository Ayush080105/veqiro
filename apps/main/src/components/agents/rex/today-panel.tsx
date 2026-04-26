"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, Pin, X } from "lucide-react"
import { listPins, deletePin } from "@/lib/api/rex"
import { ActionResultRenderer } from "@/components/chat/ActionResultRenderer"
import type { AgentActionId } from "@/lib/types/agents"
import type { RexPinnedCard } from "@/lib/types/agents"

const PINS_KEY = ["rex", "pins"]

export function TodayPanel({ organizationId }: { organizationId: string }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const qc = useQueryClient()

  const { data: pins = [] } = useQuery<RexPinnedCard[]>({
    queryKey: PINS_KEY,
    queryFn: listPins,
    enabled: !!organizationId,
    staleTime: 30_000,
  })

  const removeMut = useMutation({
    mutationFn: deletePin,
    onSuccess: () => qc.invalidateQueries({ queryKey: PINS_KEY }),
  })

  if (pins.length === 0) return null

  return (
    <div className="border-b border-border bg-muted/10">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-muted/20"
      >
        <Pin className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Today — {pins.length} pinned
        </span>
        <span className="ml-auto">
          {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </span>
      </button>

      {!collapsed && (
        <div className="flex gap-3 overflow-x-auto px-4 pb-3">
          {pins.map((pin) => (
            <div key={pin.id} className="relative min-w-[280px] max-w-[340px] shrink-0">
              <button
                type="button"
                aria-label="Unpin"
                onClick={() => removeMut.mutate(pin.id)}
                className="absolute right-1 top-1 z-10 rounded p-0.5 hover:bg-destructive/10"
              >
                <X className="size-3 text-muted-foreground hover:text-destructive" />
              </button>
              <ActionResultRenderer
                actionId={pin.kind as AgentActionId}
                result={pin.payload}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Re-export the queryKey so other components can invalidate it
export { PINS_KEY }
