"use client"

import * as React from "react"
import { use } from "react"
import { ActionResultRenderer } from "@/components/chat/ActionResultRenderer"
import type { AgentActionId } from "@/lib/types/agents"

interface SharedPin {
  kind: string
  payload: unknown
  createdAt: string
}

const KIND_TO_ACTION: Record<string, AgentActionId> = {
  "analyze-metrics": "rex:analyze-metrics",
  forecast: "rex:forecast",
  "financial-analysis": "rex:financial-analysis",
  briefing: "rex:compile-briefing",
  runway: "rex:runway",
  "unit-economics": "rex:unit-economics",
  scenario: "rex:scenario",
  "weekly-digest": "rex:weekly-digest",
  "investor-update": "rex:investor-update",
  variance: "rex:variance",
  "board-deck": "rex:board-deck",
}

function getApiBase() {
  return process.env.NEXT_PUBLIC_SERVER_URL || ""
}

async function fetchSharedPin(token: string): Promise<SharedPin | null> {
  try {
    const res = await fetch(`${getApiBase()}/agents/rex/pins/public/${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as SharedPin
  } catch {
    return null
  }
}

export default function SharedRexPinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [pin, setPin] = React.useState<SharedPin | null | undefined>(undefined)

  React.useEffect(() => {
    void fetchSharedPin(token).then(setPin)
  }, [token])

  if (pin === undefined) {
    return (
      <div className="min-h-screen bg-[#FFF9ED] flex items-center justify-center">
        <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
          Loading…
        </p>
      </div>
    )
  }

  if (pin === null) {
    return (
      <div className="min-h-screen bg-[#FFF9ED] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="font-mono text-[12px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Card unavailable
          </h1>
          <p className="text-[14px] text-foreground">
            This card is no longer public, or the link is invalid.
          </p>
        </div>
      </div>
    )
  }

  const actionId = KIND_TO_ACTION[pin.kind]

  return (
    <div className="min-h-screen bg-[#FFF9ED]">
      <header className="border-b-2 border-[#111] px-6 py-4 bg-white">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Shared by REX
            </p>
            <h1 className="text-[22px] font-bold leading-tight">{pin.kind.replace(/-/g, " ")}</h1>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {new Date(pin.createdAt).toLocaleDateString()}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        {actionId ? (
          <ActionResultRenderer actionId={actionId} result={pin.payload} />
        ) : (
          <pre className="overflow-auto rounded border border-border bg-muted/20 p-3 text-[10px]">
            {JSON.stringify(pin.payload, null, 2)}
          </pre>
        )}
      </main>
      <footer className="px-6 py-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Powered by REX · Veqiro
      </footer>
    </div>
  )
}
