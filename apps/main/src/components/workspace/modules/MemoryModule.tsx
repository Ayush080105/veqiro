"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Bot, Check, FileUp, List, Network, User, X } from "lucide-react"

import {
  useUpdateMemoryItem,
  useWorkspaceMemory,
  type MemoryItem,
  type MemoryOrigin,
} from "@/lib/api/workspace"
import type { ModuleProps } from "@/lib/workspace/types"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { SegmentedGroup } from "@/components/ui/segmented-group"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgentWorkspace } from "../AgentWorkspaceContext"
import { AddMemoryForm } from "./AddMemoryForm"

// Pointer-driven and only useful once there is something to draw; not worth
// shipping to everyone who opens Memory to read a list.
const MemoryGraph = dynamic(() => import("./MemoryGraph").then((m) => m.MemoryGraph), {
  ssr: false,
  loading: () => <Skeleton className="h-[460px] rounded-[var(--vq-r)]" />,
})
import { StatusPill } from "@/components/ui/status-pill"

const ORIGIN_ICON: Record<MemoryOrigin, typeof User> = {
  USER: User,
  AGENT: Bot,
  IMPORTED: FileUp,
}

const ORIGIN_LABEL: Record<MemoryOrigin, string> = {
  USER: "You told it this",
  AGENT: "Inferred from a conversation",
  IMPORTED: "Read from your data",
}

/**
 * What this employee works from, and where each piece came from.
 *
 * Provenance is the whole point. A list of assertions about someone's business
 * with no indication of origin or confirmation is not something they can
 * sensibly edit or trust — and an agent confidently acting on an unconfirmed
 * guess is exactly the failure the PRD's memory requirements are aimed at.
 */
export function MemoryModule({ agent }: ModuleProps) {
  const { data, isLoading } = useWorkspaceMemory(agent)
  const update = useUpdateMemoryItem(agent)
  const { config } = useAgentWorkspace()
  const [view, setView] = useState<"graph" | "list">("graph")

  if (isLoading) return <Skeleton className="h-48 rounded-[var(--vq-r)]" />

  const items = data?.items ?? []
  const unconfirmed = items.filter((item) => !item.confirmed)
  const confirmed = items.filter((item) => item.confirmed)

  return (
    <div className="flex flex-col gap-4">
      {data?.runningSummary && (
        <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
          <h2 className="font-head text-sm">Working summary</h2>
          <p className="mt-2 text-sm text-muted-foreground">{data.runningSummary}</p>
        </section>
      )}

      <AddMemoryForm agent={agent} agentName={config.name} />

      {items.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {items.length} thing{items.length === 1 ? "" : "s"} {config.name} remembers
            {unconfirmed.length > 0 && ` · ${unconfirmed.length} to confirm`}
          </p>
          <SegmentedGroup
            size="sm"
            value={view}
            onValueChange={setView}
            options={[
              { value: "graph", label: "Graph", icon: <Network className="size-3.5" /> },
              { value: "list", label: "List", icon: <List className="size-3.5" /> },
            ]}
          />
        </div>
      )}

      {items.length > 0 && view === "graph" && (
        <MemoryGraph
          agentName={config.name}
          color={config.color}
          items={items}
          busy={update.isPending}
          onConfirm={(id) => update.mutate({ id, confirmed: true })}
          onRetire={(id) => update.mutate({ id, retired: true })}
        />
      )}

      {/*
        Unconfirmed first: these are the ones that want a decision, and burying
        them under things already agreed would defeat the point of tracking
        confirmation at all.
      */}
      {view === "list" && unconfirmed.length > 0 && (
        <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
          <h2 className="font-head text-sm">Worth confirming</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {agent} picked these up but hasn&apos;t been told they&apos;re right.
          </p>
          <MemoryList
            items={unconfirmed}
            busy={update.isPending}
            onConfirm={(id) => update.mutate({ id, confirmed: true })}
            onRetire={(id) => update.mutate({ id, retired: true })}
          />
        </section>
      )}

      {(view === "list" || items.length === 0) && (
      <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
        <h2 className="font-head text-sm">What it knows</h2>
        {confirmed.length === 0 ? (
          <EmptyState
            tone="plain"
            title="Nothing confirmed yet"
            description="Facts build up as you work together, and you decide which ones stick. You can also add one yourself."
          />
        ) : (
          <MemoryList
            items={confirmed}
            busy={update.isPending}
            onRetire={(id) => update.mutate({ id, retired: true })}
          />
        )}
      </section>
      )}

      <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-head text-sm">Company context</h2>
          <Link
            href="/brain"
            className="text-xs text-muted-foreground no-underline hover:text-foreground"
          >
            Edit in Brain
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {data?.org.runningSummary || "Shared across every employee. Set it up in Brain."}
        </p>
      </section>
    </div>
  )
}

function MemoryList({
  items,
  busy,
  onConfirm,
  onRetire,
}: {
  items: MemoryItem[]
  busy: boolean
  onConfirm?: (id: string) => void
  onRetire: (id: string) => void
}) {
  return (
    <ul className="mt-2 flex flex-col divide-y divide-(--vq-line-2)">
      {items.map((item) => {
        const Icon = ORIGIN_ICON[item.origin]
        return (
          <li key={item.id} className="flex items-start gap-3 py-2.5">
            <span
              className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
              title={ORIGIN_LABEL[item.origin]}
            >
              <Icon className="size-3" />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              {item.content}
              {/* Company-wide facts are shown here too, so say which are which. */}
              {item.agent === null && (
                <StatusPill level="info" className="ml-2 align-middle">
                  company
                </StatusPill>
              )}
            </span>
            <span className="flex shrink-0 gap-1">
              {onConfirm && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Confirm"
                  disabled={busy}
                  onClick={() => onConfirm(item.id)}
                >
                  <Check className="size-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label="Forget this"
                title="Stop working from this"
                disabled={busy}
                onClick={() => onRetire(item.id)}
              >
                <X className="size-4" />
              </Button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
