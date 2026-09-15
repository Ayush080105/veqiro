"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, CalendarClock, Play } from "lucide-react"
import { getIntegrationBySlug } from "@repo/integrations-catalog"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusPill } from "@/components/ui/status-pill"
import { qk } from "@/lib/query-keys"
import { usePlays, setPlayEnabled, runPlayNow, type McpPlay } from "@/lib/api/mcp"

/**
 * Plays are the unit customers think in: "handle my Monday", not "an agent
 * with Gmail access". Each row leads with the outcome and says when it happens.
 */
export function PlaysSection() {
  const { data: plays = [], isLoading, isError, error } = usePlays()
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState<string | null>(null)
  const enabledCount = plays.filter((play) => play.enabled).length

  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.mcpPlays() })
  const displayName = (slug: string) => getIntegrationBySlug(slug)?.name ?? slug

  const handleToggle = async (play: McpPlay, next: boolean) => {
    setBusyId(play.id)
    try {
      await setPlayEnabled(play.id, next)
      toast.success(next ? `On: ${play.scheduleLabel.toLowerCase()}` : "Turned off")
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
      toast.success(`Ran: check ${play.agent.toLowerCase()} for the result`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't run that")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">Recurring work</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Scheduled jobs that leave the finished draft, brief, or analysis with the agent
            that did it. Nothing is sent without your approval.
          </p>
        </div>
        {!isLoading && !isError && plays.length > 0 && (
          <StatusPill level={enabledCount > 0 ? "ok" : "info"} icon={null}>
            {enabledCount} of {plays.length} on
          </StatusPill>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-card px-4 py-5 text-sm text-muted-foreground">
          Loading recurring work...
        </div>
      ) : isError ? (
        <div className="rounded-[var(--vq-r)] border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Could not load recurring work: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : plays.length === 0 ? (
        <EmptyState
          icon={<CalendarClock />}
          title="No recurring work yet"
          description="Connect tools and turn on a play when there is a repeatable workflow worth delegating."
        />
      ) : (
        <div className="grid gap-2">
          {plays.map((play) => (
            <div
              key={play.id}
              className="grid gap-4 rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-card px-4 py-4 shadow-[var(--vq-shadow-xs)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="flex min-w-0 gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[var(--vq-r-sm)] border border-border bg-muted/35 text-muted-foreground">
                  <CalendarClock className="size-4" />
                </span>
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{play.name}</h3>
                    <StatusPill level="info" icon={null} className="capitalize">
                      {play.agent.toLowerCase()}
                    </StatusPill>
                  </div>
                  <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    {play.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{play.scheduleLabel}</span>
                    {play.lastRunAt && !play.lastError && (
                      <span>Last ran {new Date(play.lastRunAt).toLocaleString()}</span>
                    )}
                  </div>
                  {play.missing.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Needs {play.missing.map(displayName).join(" and ")}.
                    </p>
                  )}
                  {play.lastError && (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      Last run failed: {play.lastError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRunNow(play)}
                  disabled={!play.available || busyId === play.id}
                >
                  <Play className="size-3.5" />
                  Run now
                </Button>
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
    </section>
  )
}
