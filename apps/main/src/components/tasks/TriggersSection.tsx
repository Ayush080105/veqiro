"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, ChevronDown, Search, Zap } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { StatusPill } from "@/components/ui/status-pill"
import { qk } from "@/lib/query-keys"
import {
  useMcpTriggers,
  subscribeMcpTrigger,
  setMcpTriggerEnabled,
  unsubscribeMcpTrigger,
  type McpTrigger,
} from "@/lib/api/mcp"

/**
 * Everything the org's connected tools can wake an agent for.
 *
 * Triggers are discovered from provider catalogues, so grouping by integration
 * keeps the list scannable without hiding what is available.
 */
export function TriggersSection() {
  const { data: triggers = [], isLoading, isError, error } = useMcpTriggers()
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.mcpTriggers() })

  const handleToggle = async (trigger: McpTrigger, next: boolean) => {
    setBusyId(trigger.id)
    try {
      if (next) {
        await (trigger.subscribed
          ? setMcpTriggerEnabled(trigger.id, true)
          : subscribeMcpTrigger(trigger.id))
        toast.success(`On: ${trigger.label.toLowerCase()}`)
      } else {
        await setMcpTriggerEnabled(trigger.id, false)
        toast.success("Turned off")
      }
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change that")
    } finally {
      setBusyId(null)
    }
  }

  const handleRemove = async (trigger: McpTrigger) => {
    setBusyId(trigger.id)
    try {
      await unsubscribeMcpTrigger(trigger.id)
      toast.success("Removed")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that")
    } finally {
      setBusyId(null)
    }
  }

  const { groups, activeCount } = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = needle
      ? triggers.filter(
          (trigger) =>
            trigger.label.toLowerCase().includes(needle) ||
            trigger.integrationName.toLowerCase().includes(needle),
        )
      : triggers

    const byIntegration = new Map<string, McpTrigger[]>()
    for (const trigger of matched) {
      const list = byIntegration.get(trigger.integrationName) ?? []
      list.push(trigger)
      byIntegration.set(trigger.integrationName, list)
    }

    return {
      groups: [...byIntegration.entries()],
      activeCount: triggers.filter((trigger) => trigger.enabled).length,
    }
  }, [triggers, query])

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">Act without being asked</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Let an agent respond when something happens in a connected tool. Nothing is ever
            sent on your behalf; every action waits for your approval.
          </p>
        </div>
        {!isLoading && !isError && triggers.length > 0 && (
          <StatusPill level={activeCount > 0 ? "ok" : "info"} icon={null}>
            {activeCount} of {triggers.length} on
          </StatusPill>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-card px-4 py-5 text-sm text-muted-foreground">
          Loading triggers...
        </div>
      ) : isError ? (
        <div className="rounded-[var(--vq-r)] border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Could not load triggers: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : triggers.length === 0 ? (
        <EmptyState
          icon={<Zap />}
          title="No triggers available"
          description="Connect a tool like Gmail, Slack, or Linear and its trigger catalogue will appear here."
        />
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search triggers..."
              className="pl-8"
            />
          </div>

          {groups.length === 0 ? (
            <EmptyState
              tone="plain"
              icon={<Search />}
              title="No matching triggers"
              description="Try another integration, event name, or agent."
              className="rounded-[var(--vq-r)] border border-dashed border-[var(--vq-line-2)] bg-card"
            />
          ) : (
            groups.map(([integrationName, items]) => (
              <details
                key={integrationName}
                open={items.some((trigger) => trigger.enabled) || Boolean(query.trim())}
                className="group rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-card shadow-[var(--vq-shadow-xs)]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                  <span>{integrationName}</span>
                  <span className="flex items-center gap-2">
                    <StatusPill
                      level={items.some((trigger) => trigger.enabled) ? "ok" : "info"}
                      icon={null}
                    >
                      {items.filter((trigger) => trigger.enabled).length}/{items.length}
                    </StatusPill>
                    <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </span>
                </summary>

                <div className="border-t border-[var(--vq-line-2)]">
                  {items.map((trigger) => (
                    <div
                      key={trigger.id}
                      className="grid gap-4 border-b border-[var(--vq-line-2)] px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="flex min-w-0 gap-3">
                        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[var(--vq-r-sm)] border border-border bg-muted/35 text-muted-foreground">
                          <Zap className="size-4" />
                        </span>
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">
                              {trigger.label}
                            </h3>
                            <StatusPill level="info" icon={null} className="capitalize">
                              {trigger.agent.toLowerCase()}
                            </StatusPill>
                          </div>
                          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                            {trigger.description}
                          </p>
                          {!trigger.curated && (
                            <p className="text-xs text-muted-foreground">
                              General handling: the agent judges what to do.
                            </p>
                          )}
                          {trigger.lastError && (
                            <p className="flex items-center gap-1.5 text-xs text-destructive">
                              <AlertTriangle className="size-3.5 shrink-0" />
                              {trigger.lastError}
                            </p>
                          )}
                          {trigger.enabled && trigger.lastEventAt && (
                            <p className="text-xs text-muted-foreground">
                              Last fired {new Date(trigger.lastEventAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        {trigger.subscribed && !trigger.enabled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(trigger)}
                            disabled={busyId === trigger.id}
                          >
                            Remove
                          </Button>
                        )}
                        <Switch
                          checked={trigger.enabled}
                          disabled={busyId === trigger.id}
                          onCheckedChange={(next) => handleToggle(trigger, next)}
                          aria-label={trigger.label}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))
          )}
        </>
      )}
    </section>
  )
}
