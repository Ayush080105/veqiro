"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, Search, Zap } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
 * Discovered rather than curated: the provider publishes what each toolkit can
 * trigger on, and hiding all but a hand-picked seven meant most of what was
 * possible was invisible. Measured across the catalogue — 21 of 46 integrations
 * expose triggers, 191 types between them.
 *
 * That volume is why this groups by integration and offers a filter. A flat
 * list of everything Confluence alone can emit is 23 rows, and the customer is
 * looking for one of them.
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
        toast.success(`On — ${trigger.label.toLowerCase()}`)
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
          (t) =>
            t.label.toLowerCase().includes(needle) ||
            t.integrationName.toLowerCase().includes(needle),
        )
      : triggers

    const byIntegration = new Map<string, McpTrigger[]>()
    for (const t of matched) {
      const list = byIntegration.get(t.integrationName) ?? []
      list.push(t)
      byIntegration.set(t.integrationName, list)
    }
    return {
      groups: [...byIntegration.entries()],
      activeCount: triggers.filter((t) => t.enabled).length,
    }
  }, [triggers, query])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-foreground">Act without being asked</h2>
        <p className="text-xs text-muted-foreground">
          Let an agent respond when something happens in a connected tool. Nothing
          is ever sent on your behalf — every action waits for your approval.
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="text-xs text-destructive">
          Couldn&apos;t load these: {error instanceof Error ? error.message : "Unknown error"}
        </p>
      ) : triggers.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          None of your connected tools publish events yet. Connect something like
          Gmail, Slack or Linear and its triggers appear here.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-50 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search triggers…"
                className="pl-8"
              />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {activeCount} on · {triggers.length} available
            </span>
          </div>

          {groups.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing matches that.</p>
          ) : (
            groups.map(([integrationName, items]) => (
              <details
                key={integrationName}
                // Open where something is already switched on, so the things
                // actually running are visible without hunting for them.
                open={items.some((t) => t.enabled) || Boolean(query.trim())}
                className="rounded-lg border border-[#D4C9B0]"
              >
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium">
                  {integrationName}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {items.filter((t) => t.enabled).length}/{items.length}
                  </span>
                </summary>

                <div className="flex flex-col gap-2 px-3 pb-3">
                  {items.map((trigger) => (
                    <div
                      key={trigger.id}
                      className="flex items-center justify-between gap-4 rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] px-3 py-2.5"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Zap className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-xs font-medium">{trigger.label}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {trigger.agent.toLowerCase()}
                          </Badge>
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {trigger.description}
                        </p>
                        {/* Says plainly which of these have a hand-written
                            instruction and which fall back to the generic one,
                            since that materially changes how well they behave. */}
                        {!trigger.curated && (
                          <p className="text-[11px] text-muted-foreground/60">
                            General handling — the agent judges what to do.
                          </p>
                        )}
                        {trigger.lastError && (
                          <p className="flex items-center gap-1 text-[11px] text-destructive">
                            <AlertTriangle className="size-3 shrink-0" />
                            {trigger.lastError}
                          </p>
                        )}
                        {trigger.enabled && trigger.lastEventAt && (
                          <p className="text-[11px] text-muted-foreground/70">
                            Last fired {new Date(trigger.lastEventAt).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {trigger.subscribed && !trigger.enabled && (
                          <button
                            onClick={() => handleRemove(trigger)}
                            disabled={busyId === trigger.id}
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
                          >
                            Remove
                          </button>
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
    </div>
  )
}
