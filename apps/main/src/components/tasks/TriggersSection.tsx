"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, Zap } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { qk } from "@/lib/query-keys"
import {
  useMcpTriggers,
  subscribeMcpTrigger,
  setMcpTriggerEnabled,
  unsubscribeMcpTrigger,
  type McpTrigger,
} from "@/lib/api/mcp"

/**
 * Everything else in the product runs because someone asked. These are the
 * events the org has allowed an agent to act on unprompted — so the section
 * says plainly what an agent will do, and that nothing is ever sent without
 * approval. That sentence is the whole basis for switching any of these on.
 */
export function TriggersSection() {
  const { data: triggers = [], isLoading, isError, error } = useMcpTriggers()
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.mcpTriggers() })

  const handleToggle = async (trigger: McpTrigger, next: boolean) => {
    setBusyId(trigger.id)
    try {
      if (next) {
        // First time on, this creates the subscription with Composio; after
        // that it is only a flag, so re-enabling is instant.
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

  return (
    <div className="flex flex-col gap-3 pt-2">
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
      ) : (
        <div className="flex flex-col gap-2">
          {triggers.map((trigger) => (
            <div
              key={trigger.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] px-3 py-2.5"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Zap className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs font-medium">{trigger.label}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {trigger.agent.toLowerCase()}
                  </Badge>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {trigger.description}
                </p>
                {!trigger.available && (
                  <p className="text-[11px] text-muted-foreground/70">
                    Connect {trigger.integrationSlug.replace(/-/g, " ")} to use this.
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
                  disabled={!trigger.available || busyId === trigger.id}
                  onCheckedChange={(next) => handleToggle(trigger, next)}
                  aria-label={trigger.label}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
