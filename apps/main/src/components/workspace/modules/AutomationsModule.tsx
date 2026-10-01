"use client"

import { useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Play, Repeat, Zap } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"

import {
  runPlayNow,
  setPlayEnabled,
  useMcpTriggers,
  usePlays,
  type McpPlay,
} from "@/lib/api/mcp"
import { qk } from "@/lib/query-keys"
import type { ModuleProps } from "@/lib/workspace/types"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { Switch } from "@/components/ui/switch"

/**
 * The recurring and event-driven work this employee does without being asked.
 *
 * The PRD is specific about what an automation has to show — trigger, next
 * run, last run, result and failure state — because the failure mode of
 * automation is not "it did the wrong thing", it is "it silently stopped and
 * nobody noticed for a month". Every one of those is on the row.
 */
export function AutomationsModule({ agent }: ModuleProps) {
  const queryClient = useQueryClient()
  const { data: plays, isLoading } = usePlays()
  const { data: triggers } = useMcpTriggers()
  const [busyId, setBusyId] = useState<string | null>(null)

  const agentPlays = (plays ?? []).filter(
    (play) => play.agent.toLowerCase() === agent,
  )
  const agentTriggers = (triggers ?? []).filter(
    (trigger) => trigger.agent.toLowerCase() === agent && trigger.subscribed,
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-20 rounded-[var(--vq-r)]" />
        <Skeleton className="h-20 rounded-[var(--vq-r)]" />
      </div>
    )
  }

  if (agentPlays.length === 0 && agentTriggers.length === 0) {
    return (
      <EmptyState
        icon={<Repeat />}
        title="No automations for this employee yet"
        description="Recurring work and event-driven jobs will appear here once there are some to run."
      />
    )
  }

  const toggle = async (play: McpPlay, enabled: boolean) => {
    setBusyId(play.id)
    try {
      await setPlayEnabled(play.id, enabled)
      await queryClient.invalidateQueries({ queryKey: qk.mcpPlays() })
      toast.success(enabled ? `${play.name} is on.` : `${play.name} is off.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change that.")
    } finally {
      setBusyId(null)
    }
  }

  const runNow = async (play: McpPlay) => {
    setBusyId(play.id)
    try {
      await runPlayNow(play.id)
      await queryClient.invalidateQueries({ queryKey: qk.mcpPlays() })
      toast.success(`${play.name} ran.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That run failed.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {agentPlays.length > 0 && (
        <section>
          <h2 className="mb-2 font-head text-sm">On a schedule</h2>
          <ul className="flex flex-col gap-2">
            {agentPlays.map((play) => (
              <li
                key={play.id}
                className="flex flex-wrap items-center gap-3 rounded-[var(--vq-r)] border border-border bg-card p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[var(--vq-r-sm)] bg-muted">
                  <Repeat className="size-4 text-muted-foreground" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{play.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {play.scheduleLabel}
                    {play.enabled && play.nextRunAt && ` · next ${formatWhen(play.nextRunAt)}`}
                    {play.lastRunAt && ` · last ran ${formatWhen(play.lastRunAt)}`}
                  </p>
                  {/*
                    A failed automation is the one thing that must not be quiet:
                    it looks identical to a working one until someone checks.
                  */}
                  {play.lastError && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="size-3 shrink-0" />
                      <span className="truncate">{play.lastError}</span>
                    </p>
                  )}
                  {!play.available && play.missing.length > 0 && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Needs {play.missing.join(" and ")}
                    </p>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!play.available || busyId === play.id}
                  onClick={() => void runNow(play)}
                  className="shrink-0 gap-1.5"
                >
                  <Play className="size-3.5" />
                  Run now
                </Button>
                <Switch
                  checked={play.enabled}
                  disabled={!play.available || busyId === play.id}
                  onCheckedChange={(checked) => void toggle(play, checked)}
                  aria-label={`Turn ${play.name} ${play.enabled ? "off" : "on"}`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {agentTriggers.length > 0 && (
        <section>
          <h2 className="mb-2 font-head text-sm">On an event</h2>
          <ul className="flex flex-col gap-2">
            {agentTriggers.map((trigger) => (
              <li
                key={trigger.id}
                className="flex flex-wrap items-center gap-3 rounded-[var(--vq-r)] border border-border bg-card p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[var(--vq-r-sm)] bg-muted">
                  <Zap className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{trigger.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {trigger.integrationName}
                    {trigger.lastEventAt && ` · last fired ${formatWhen(trigger.lastEventAt)}`}
                  </p>
                  {trigger.lastError && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="size-3 shrink-0" />
                      <span className="truncate">{trigger.lastError}</span>
                    </p>
                  )}
                </div>
                <StatusPill level={trigger.enabled ? "ok" : "info"} className="shrink-0">
                  {trigger.enabled ? "Listening" : "Paused"}
                </StatusPill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** Relative for anything close, absolute once it stops being useful. */
function formatWhen(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = then - Date.now()
  const past = diff < 0
  const minutes = Math.round(Math.abs(diff) / 60_000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return past ? `${minutes}m ago` : `in ${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return past ? `${hours}h ago` : `in ${hours}h`
  const days = Math.round(hours / 24)
  if (days < 7) return past ? `${days}d ago` : `in ${days}d`
  return new Date(iso).toLocaleDateString()
}
