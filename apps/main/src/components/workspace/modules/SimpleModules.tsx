"use client"

import Link from "next/link"
import { Construction, Plug } from "lucide-react"

import { getIntegrationsByAgent } from "@repo/integrations-catalog"
import { useMcpConnections } from "@/lib/api/mcp"
import {
  useWorkspaceActivity,
  useWorkspaceApprovals,
  useWorkspaceMemory,
} from "@/lib/api/workspace"
import { MODULE_META } from "@/lib/workspace/modules"
import type { ModuleId, ModuleProps } from "@/lib/workspace/types"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { ActivityFeed } from "../panels/ActivityFeed"

/**
 * The framework's default modules — the ones that are free because the data
 * they show already exists. An agent only writes its own component when it has
 * something these cannot express.
 */

export function ActivityModule({ agent }: ModuleProps) {
  const { data, isLoading } = useWorkspaceActivity(agent)
  return (
    <div className="rounded-[var(--vq-r)] border border-border bg-card p-4">
      <ActivityFeed events={data?.events} loading={isLoading} />
    </div>
  )
}

export function ApprovalsModule({ agent }: ModuleProps) {
  const { data, isLoading } = useWorkspaceApprovals(agent)

  if (isLoading) {
    return <Skeleton className="h-40 rounded-[var(--vq-r)]" />
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Construction />}
        title="Nothing waiting on you"
        description="Actions that need your say-so before they run will queue up here."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {data.map((approval) => (
        <li
          key={approval.id}
          className="flex flex-wrap items-center gap-3 rounded-[var(--vq-r)] border border-border bg-card p-3"
        >
          <StatusPill level="warn" className="shrink-0">
            {approval.integrationSlug === "native" ? "action" : approval.integrationSlug}
          </StatusPill>
          <span className="min-w-0 flex-1 text-sm">{approval.summary}</span>
          {/*
            Confirm/reject deliberately live in the chat dock's existing
            PendingMcpActionCard rather than being reimplemented here: it owns
            the retry, rate-limit and error handling, and two code paths that
            can approve a write is exactly one too many.
          */}
          <span className="shrink-0 text-xs text-muted-foreground">
            Review in chat
          </span>
        </li>
      ))}
    </ul>
  )
}

export function MemoryModule({ agent }: ModuleProps) {
  const { data, isLoading } = useWorkspaceMemory(agent)

  if (isLoading) return <Skeleton className="h-40 rounded-[var(--vq-r)]" />

  const facts = data?.longTermFacts ?? []
  const orgFacts = data?.org.longTermFacts ?? []

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
        <h2 className="font-head text-sm">What this employee remembers</h2>
        {data?.runningSummary ? (
          <p className="mt-2 text-sm text-muted-foreground">{data.runningSummary}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing yet — context builds up as you work together.
          </p>
        )}
        {facts.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {facts.map((fact, i) => (
              <li key={i} className="text-sm">
                {fact}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-head text-sm">Company context</h2>
          <Link href="/brain" className="text-xs text-muted-foreground no-underline hover:text-foreground">
            Edit in Brain
          </Link>
        </div>
        {orgFacts.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {orgFacts.map((fact, i) => (
              <li key={i} className="text-sm">
                {fact}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Shared across every employee. Set it up in Brain.
          </p>
        )}
      </section>
    </div>
  )
}

export function IntegrationsModule({ agent }: ModuleProps) {
  const { data: connections } = useMcpConnections()
  const entries = getIntegrationsByAgent(agent as Parameters<typeof getIntegrationsByAgent>[0])

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {entries.map((entry) => {
        const connection = connections?.find((c) => c.slug === entry.slug)
        const connected = connection?.status === "CONNECTED"
        return (
          <div
            key={entry.slug}
            className="flex items-center gap-3 rounded-[var(--vq-r)] border border-border bg-card p-3"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-[var(--vq-r-sm)] bg-muted">
              <Plug className="size-4 text-muted-foreground" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{entry.name}</span>
              <span className="block text-xs text-muted-foreground">{entry.category}</span>
            </span>
            {connected ? (
              <StatusPill level="ok">Connected</StatusPill>
            ) : entry.status === "composio" ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/settings/integrations">Connect</Link>
              </Button>
            ) : (
              <StatusPill level="info">Soon</StatusPill>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * A module an agent has not implemented yet.
 *
 * Renders rather than 404s on purpose: a dead link reads as a bug, whereas
 * "not yet" reads as a roadmap — and the customer needs to be able to tell the
 * difference at a glance.
 */
export function ComingSoonModule({ moduleId }: { moduleId: ModuleId }) {
  const meta = MODULE_META[moduleId]
  return (
    <EmptyState
      icon={<Construction />}
      title={`${meta.label} is coming`}
      description={meta.blurb}
    />
  )
}
