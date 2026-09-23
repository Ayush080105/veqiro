"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { ChevronsUpDown, Users } from "lucide-react"

import { AGENTS, AGENT_PHOTOS } from "@/lib/config/agents"
import { useCompanyPulse } from "@/lib/api/workspace"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAgentWorkspace } from "./AgentWorkspaceContext"

/**
 * Move between employees without leaving the workspace.
 *
 * Shows what each one is sitting on, because the reason to switch is usually
 * that someone else needs you — and having to go back out to the directory to
 * find that out would make the directory the real navigation and this a
 * decoration.
 */
export function AgentSwitcher() {
  const router = useRouter()
  const { agent, organizationId } = useAgentWorkspace()
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
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground"
            aria-label="Switch employee"
          />
        }
      >
        <ChevronsUpDown className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Your employees</DropdownMenuLabel>
        <DropdownMenuSeparator />
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
