"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Plug } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { AGENTS, AGENT_PHOTOS } from "@/lib/config/agents"
import { useCompanyPulse, type AgentPulse } from "@/lib/api/workspace"
import { WORKSPACE_MIGRATED } from "@/lib/workspace/migrated"
import type { AgentConfig, AgentSlug } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"

/**
 * The way into the workforce.
 *
 * Replaces the old chat-list-and-empty-state, which framed the product as six
 * conversations to pick between. This frames it as six people: what each one
 * owns, and which of them is waiting on you — the PRD's "what needs my
 * attention?" asked across the whole team before you have opened anything.
 *
 * Sorted by what needs a decision, not alphabetically. A directory that always
 * lists Lex first is a menu; one that puts the employee waiting on you at the
 * top is a workplace.
 */
export function EmployeeDirectory() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const { data: pulse, isLoading } = useCompanyPulse(organizationId)

  const needsYouFor = (slug: string) => {
    const row = pulse?.agents.find((a) => a.agent.toLowerCase() === slug)
    return row ? row.pendingApprovals + row.needsReview : 0
  }
  const findingsFor = (slug: string) => {
    const row = pulse?.agents.find((a) => a.agent.toLowerCase() === slug)
    return row?.openInsights ?? 0
  }

  const ordered = [...AGENTS].sort(
    (a, b) =>
      needsYouFor(b.id) - needsYouFor(a.id) || findingsFor(b.id) - findingsFor(a.id),
  )

  const totalWaiting = pulse
    ? pulse.totals.pendingApprovals + pulse.totals.needsReview
    : 0

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="font-head text-2xl">Your AI employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLoading
            ? "Checking what everyone is working on…"
            : totalWaiting === 0
              ? "Nobody is waiting on you right now."
              : `${totalWaiting} ${totalWaiting === 1 ? "thing needs" : "things need"} your attention.`}
        </p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {AGENTS.map((agent) => (
            <Skeleton key={agent.id} className="h-40 rounded-[var(--vq-r)]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ordered.map((agent) => (
            <EmployeeCard
              key={agent.id}
              agent={agent}
              pulse={pulse?.agents.find((a) => a.agent.toLowerCase() === agent.id)}
            />
          ))}
        </div>
      )}

      <Link
        href="/settings/integrations"
        data-tour="onboard-me-button"
        className="inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground no-underline transition-colors hover:text-foreground"
      >
        <Plug className="size-3.5" />
        Connect your tools so they can do more
      </Link>
    </div>
  )
}

function EmployeeCard({ agent, pulse }: { agent: AgentConfig; pulse?: AgentPulse }) {
  const photo = AGENT_PHOTOS[agent.id]
  const needsYou = pulse ? pulse.pendingApprovals + pulse.needsReview : 0
  const findings = pulse?.openInsights ?? 0
  const serious = pulse?.criticalInsights ?? 0

  // Migrated agents open their workspace; the rest still open chat. Both are
  // the same door as far as the customer is concerned.
  const href = WORKSPACE_MIGRATED.has(agent.id as AgentSlug)
    ? `/workspace/${agent.id}/overview`
    : `/assistants/${agent.id}`

  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-3 rounded-[var(--vq-r)] border bg-card p-4 no-underline transition-[background-color,border-color]",
        needsYou > 0
          ? "border-[color:var(--vq-yellow)]/50 hover:bg-muted/40"
          : "border-border hover:bg-muted/40",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className="relative size-10 shrink-0 overflow-hidden rounded-full border border-border"
          style={{ background: agent.color }}
        >
          {photo ? (
            <Image src={photo} alt={agent.name} fill sizes="40px" className="object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center font-head text-xs text-white">
              {agent.initials}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-head text-sm">{agent.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{agent.role}</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {/* What they own, in their own words. */}
      <p className="line-clamp-2 text-xs text-muted-foreground">{agent.tag}</p>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {needsYou > 0 && <StatusPill level="warn">{needsYou} needs you</StatusPill>}
        {findings > 0 && (
          <StatusPill level={serious > 0 ? "danger" : "info"}>
            {findings} found
          </StatusPill>
        )}
        {needsYou === 0 && findings === 0 && (
          <span className="text-xs text-muted-foreground">
            {pulse?.lastActivityAt ? "All clear" : "Nothing yet"}
          </span>
        )}
      </div>
    </Link>
  )
}
