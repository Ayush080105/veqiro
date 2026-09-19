"use client"

import * as Icons from "lucide-react"
import { Lock } from "lucide-react"

import { AGENT_ACTIONS } from "@/lib/agents/actions"
import type { ModuleProps } from "@/lib/workspace/types"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"
import { useWorkspaceChat } from "../WorkspaceChatProvider"

/**
 * "What can I ask this employee to do?" — the 47-action catalog, laid out as a
 * browsable surface instead of hidden behind a "+" in the composer.
 *
 * Free for every agent because the catalog already exists and every entry
 * already knows how to run: clicking one opens the same RunActionDialog the
 * chat composer opens, and its result renders through the same unchanged
 * ActionResultRenderer. Vega has no entries yet, which is why this renders an
 * honest empty state rather than assuming there is always something here.
 */
export function ActionsModule({ agent }: ModuleProps) {
  const { openAction } = useWorkspaceChat()
  const actions = (AGENT_ACTIONS[agent] ?? []).filter((a) => !a.hideFromMenu)

  if (actions.length === 0) {
    return (
      <EmptyState
        icon={<Icons.Sparkles />}
        title="No actions yet"
        description="This employee works through chat for now. Its actions will appear here as they're added."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {actions.map((action) => {
        // The catalog stores an icon name; ToolsMenu resolves it the same way.
        const Icon = (Icons[action.icon as keyof typeof Icons] ??
          Icons.Sparkles) as Icons.LucideIcon

        return (
          <button
            key={action.id}
            type="button"
            disabled={action.locked}
            onClick={() => openAction(action.id)}
            className={cn(
              "flex w-full items-start gap-3 rounded-[var(--vq-r)] border border-border bg-card p-3 text-left transition-colors",
              action.locked
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:bg-muted/60",
            )}
          >
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[var(--vq-r-sm)] bg-muted">
              {action.locked ? (
                <Lock className="size-4 text-muted-foreground" />
              ) : (
                <Icon className="size-4 text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-sm">{action.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {action.description}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
