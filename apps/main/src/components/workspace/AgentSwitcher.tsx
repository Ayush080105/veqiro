"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { ChevronsUpDown, Users } from "lucide-react"

import { AGENTS, AGENT_PHOTOS } from "@/lib/config/agents"
import { useCompanyPulse } from "@/lib/api/workspace"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAgentWorkspace } from "./AgentWorkspaceContext"

/**
 * Move between employees without leaving the workspace.
 *
 * The trigger IS the identity block (avatar, name, role), not a bare chevron
 * icon: an unlabelled ⇕ beside the theme and chat toggles read as a mystery
 * control. "Who am I working with? Tap to change" is the familiar pattern.
 *
 * Shows what each one is sitting on, because the reason to switch is usually
 * that someone else needs you — and having to go back out to the directory to
 * find that out would make the directory the real navigation and this a
 * decoration.
 */
export function AgentSwitcher({
  subtitle,
  compactSubtitle,
}: {
  /** Shown from `md` up — normally the employee's role. */
  subtitle: string
  /** Shown below `md`, where "where am I?" matters more than the role. */
  compactSubtitle?: string
}) {
  const router = useRouter()
  const { agent, config, organizationId } = useAgentWorkspace()
  const { data: pulse } = useCompanyPulse(organizationId)

  const needsYouFor = (slug: string) => {
    const row = pulse?.agents.find((a) => a.agent.toLowerCase() === slug)
    if (!row) return 0
    return row.pendingApprovals + row.needsReview + row.openInsights
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Switch employee — currently ${config.name}`}
            className="flex min-w-0 max-w-[18rem] items-center gap-2 rounded-[var(--vq-r-sm)] px-1 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          />
        }
      >
        <span
          className="relative size-8 shrink-0 overflow-hidden rounded-full border border-border"
          style={{ background: config.color }}
        >
          {AGENT_PHOTOS[agent] ? (
            <Image src={AGENT_PHOTOS[agent]} alt="" fill sizes="32px" className="object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center font-head text-[11px] text-white">
              {config.initials}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-head text-sm leading-tight">{config.name}</span>
          <span
            className={
              compactSubtitle
                ? "hidden truncate text-xs text-muted-foreground md:block"
                : "block truncate text-xs text-muted-foreground"
            }
          >
            {subtitle}
          </span>
          {compactSubtitle && (
            <span className="block truncate text-xs text-muted-foreground md:hidden">
              {compactSubtitle}
            </span>
          )}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        {/* Base UI's GroupLabel throws unless it is inside a Group. */}
        <DropdownMenuGroup>
        <DropdownMenuLabel>Your employees</DropdownMenuLabel>
        {AGENTS.map((candidate) => {
          const count = needsYouFor(candidate.id)
          return (
            <DropdownMenuItem
              key={candidate.id}
              disabled={candidate.id === agent}
              onClick={() => router.push(`/workspace/${candidate.id}/overview`)}
              className="gap-2.5"
            >
              <span
                className="relative size-6 shrink-0 overflow-hidden rounded-full border border-border"
                style={{ background: candidate.color }}
              >
                {AGENT_PHOTOS[candidate.id] && (
                  <Image
                    src={AGENT_PHOTOS[candidate.id]}
                    alt=""
                    fill
                    sizes="24px"
                    className="object-cover"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{candidate.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {candidate.role}
                </span>
              </span>
              {count > 0 && (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {count}
                </span>
              )}
            </DropdownMenuItem>
          )
        })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/assistants/team")} className="gap-2.5">
          <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border bg-muted text-muted-foreground">
            <Users className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">Team room</span>
            <span className="block truncate text-xs text-muted-foreground">
              One job, several employees
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
