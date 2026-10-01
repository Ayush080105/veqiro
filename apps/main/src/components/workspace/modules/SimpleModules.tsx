"use client"

import Link from "next/link"
import { Construction, Plug } from "lucide-react"

import { getIntegrationsByAgent } from "@repo/integrations-catalog"
import { platformSlugToEnum, useIntegrations } from "@/lib/api/integrations"
import { useMcpConnections } from "@/lib/api/mcp"
import { LEGACY_MCP_SLUGS } from "@/lib/config/legacy-integrations"
import { useWorkspaceActivity, useWorkspaceApprovals } from "@/lib/api/workspace"
import { MODULE_META } from "@/lib/workspace/modules"
import type { ModuleId, ModuleProps } from "@/lib/workspace/types"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { ActivityFeed } from "../panels/ActivityFeed"
import { IntegrationCatalogCard } from "@/components/integrations/IntegrationCatalogCard"
import {
  LEGACY_INTEGRATIONS,
  LegacyIntegrationCard,
} from "@/components/integrations/LegacyIntegrationCard"
import { useWorkspaceChat } from "../WorkspaceChatProvider"

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
  const { revealChat } = useWorkspaceChat()

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
          <span className="min-w-0 basis-40 flex-1 text-sm">{approval.summary}</span>
          {/*
            Confirm/reject deliberately live in the chat dock's existing
            PendingMcpActionCard rather than being reimplemented here: it owns
            the retry, rate-limit and error handling, and two code paths that
            can approve a write is exactly one too many.
          */}
          {/* A real control, not a caption: on a phone the thread is a
              separate page, so this is the only way to get to it from here. */}
          <Button size="sm" variant="outline" className="shrink-0" onClick={revealChat}>
            Review in chat
          </Button>
        </li>
      ))}
    </ul>
  )
}

export function IntegrationsModule({ agent }: ModuleProps) {
  const { data: mcpConnections = [], isPending: mcpPending } = useMcpConnections()
  const { data: accounts = [], isPending: accountsPending } = useIntegrations()
  const entries = getIntegrationsByAgent(agent as Parameters<typeof getIntegrationsByAgent>[0])

  // Until both answers are in, "not connected" would be a guess — and every
  // already-connected tool would flash under "Connect a tool".
  if (mcpPending || accountsPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-[var(--vq-r)]" />
        ))}
      </div>
    )
  }

  const connectedMcp = new Set(
    mcpConnections.filter((c) => c.status === "CONNECTED").map((c) => c.slug),
  )
  const accountPlatforms = new Set(accounts.map((a) => a.platform))

  // Exactly what Settings renders, filtered to this employee: X/LinkedIn go
  // through their native connect flow, everything else through Composio.
  const legacy = LEGACY_INTEGRATIONS.filter((l) => entries.some((e) => e.slug === l.id))
  const isLegacyConnected = (l: (typeof LEGACY_INTEGRATIONS)[number]) =>
    l.platformSlug ? accountPlatforms.has(platformSlugToEnum[l.platformSlug]) : false
  const mcp = entries.filter((e) => !LEGACY_MCP_SLUGS.has(e.slug))

  const connectedLegacy = legacy.filter(isLegacyConnected)
  const availableLegacy = legacy.filter((l) => !isLegacyConnected(l))
  const connectedMcpEntries = mcp.filter((e) => connectedMcp.has(e.slug))
  const availableMcp = mcp.filter((e) => !connectedMcp.has(e.slug))

  const connectedCount = connectedLegacy.length + connectedMcpEntries.length
  const availableCount = availableLegacy.length + availableMcp.length

  if (connectedCount + availableCount === 0) {
    return (
      <EmptyState
        icon={<Plug />}
        title="No integrations for this employee yet"
        description="Connections that unlock more for them will appear here."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {connectedCount > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeading title="Connected" note="Tools this employee can use right now." />
          <div className="grid gap-4 sm:grid-cols-2">
            {connectedLegacy.map((l) => (
              <LegacyIntegrationCard
                key={`legacy-${l.id}`}
                integration={l}
                account={
                  l.platformSlug
                    ? accounts.find((a) => a.platform === platformSlugToEnum[l.platformSlug!])
                    : undefined
                }
              />
            ))}
            {connectedMcpEntries.map((entry) => (
              <IntegrationCatalogCard key={entry.slug} entry={entry} connected />
            ))}
          </div>
        </section>
      )}

      {availableCount > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeading
            title={connectedCount > 0 ? "Available" : "Connect a tool"}
            note="Connect these to give this employee more to work with."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {availableLegacy.map((l) => (
              <LegacyIntegrationCard key={`legacy-${l.id}`} integration={l} />
            ))}
            {availableMcp.map((entry) => (
              <IntegrationCatalogCard key={entry.slug} entry={entry} connected={false} />
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Everything connected here is shared across your employees.{" "}
        <Link href="/settings/integrations" className="underline underline-offset-2 hover:text-foreground">
          Manage all integrations
        </Link>
      </p>
    </div>
  )
}

function SectionHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground">{note}</p>
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
