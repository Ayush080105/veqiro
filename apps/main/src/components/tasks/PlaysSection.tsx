"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, CalendarClock, Play } from "lucide-react"
import { getIntegrationBySlug } from "@repo/integrations-catalog"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { qk } from "@/lib/query-keys"
import { usePlays, setPlayEnabled, runPlayNow, type McpPlay } from "@/lib/api/mcp"

/**
 * Plays are the unit customers think in — "handle my Monday", not "an agent
 * with Gmail access". Each row leads with the outcome and says when it happens;
 * which integrations it uses is secondary, and only surfaces when one is
 * missing and the play therefore can't run.
 */
export function PlaysSection() {
  const { data: plays = [], isLoading, isError, error } = usePlays()
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.mcpPlays() })
  const displayName = (slug: string) => getIntegrationBySlug(slug)?.name ?? slug

  const handleToggle = async (play: McpPlay, next: boolean) => {
    setBusyId(play.id)
    try {
      await setPlayEnabled(play.id, next)
      toast.success(next ? `On — ${play.scheduleLabel.toLowerCase()}` : "Turned off")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change that")
    } finally {
      setBusyId(null)
    }
  }

  const handleRunNow = async (play: McpPlay) => {
    setBusyId(play.id)
    try {
      await runPlayNow(play.id)
      toast.success(`Ran — check ${play.agent.toLowerCase()} for the result`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't run that")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-foreground">Recurring work</h2>
        <p className="text-xs text-muted-foreground">
          Jobs that run on a schedule and leave the result with the agent that
          did it. As with everything else, nothing is sent without your approval.
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="text-xs text-destructive">
          Couldn&apos;t load these: {error instanceof Error ? error.message : "Unknown error"}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {plays.map((play) => (
            <div
              key={play.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] px-3 py-2.5"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs font-medium">{play.name}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {play.agent.toLowerCase()}
                  </Badge>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {play.description}
                </p>
                <p className="text-[11px] text-muted-foreground/70">{play.scheduleLabel}</p>

                {play.missing.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/70">
                    Needs {play.missing.map(displayName).join(" and ")}.
                  </p>
                )}
                {play.lastError && (
                  <p className="flex items-center gap-1 text-[11px] text-destructive">
                    <AlertTriangle className="size-3 shrink-0" />
                    Last run failed: {play.lastError}
                  </p>
                )}
                {play.lastRunAt && !play.lastError && (
                  <p className="text-[11px] text-muted-foreground/70">
                    Last ran {new Date(play.lastRunAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => handleRunNow(play)}
                  disabled={!play.available || busyId === play.id}
                  className="flex items-center gap-1 rounded-md border border-[#D4C9B0] px-2 py-1 text-[11px] hover:bg-[#EFE7D6] transition-colors disabled:opacity-50"
                >
                  <Play className="size-3" />
                  Run now
                </button>
                <Switch
                  checked={play.enabled}
                  disabled={!play.available || busyId === play.id}
                  onCheckedChange={(next) => handleToggle(play, next)}
                  aria-label={play.name}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
