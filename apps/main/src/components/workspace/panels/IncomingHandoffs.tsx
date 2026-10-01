"use client"

import { ArrowRightLeft } from "lucide-react"

import { useRespondToHandoff, type IncomingHandoff } from "@/lib/api/workspace"
import { findAction } from "@/lib/agents/actions"
import { getAgent } from "@/lib/config/agents"
import type { AgentActionId } from "@/lib/types/agents"
import { Button } from "@/components/ui/button"
import { useAgentWorkspace } from "../AgentWorkspaceContext"
import { useWorkspaceChat } from "../WorkspaceChatProvider"

/**
 * Work another employee has asked this one to do.
 *
 * Accepting runs nothing on its own — it opens the requested action with the
 * sender's arguments prefilled, and a human submits it. That is the difference
 * between a workforce and a machine that surprises you: the handoff carries
 * the request, the person still makes the call.
 */
export function IncomingHandoffs({ handoffs }: { handoffs?: IncomingHandoff[] }) {
  const { agent, organizationId } = useAgentWorkspace()
  const { openAction } = useWorkspaceChat()
  const respond = useRespondToHandoff(agent, organizationId)

  if (!handoffs || handoffs.length === 0) return null

  return (
    <section className="rounded-[var(--vq-r)] border border-(--vq-line-2) bg-muted/40 p-4">
      <h2 className="flex items-center gap-2 font-head text-sm">
        <ArrowRightLeft className="size-4" />
        Handed to you
      </h2>

      <ul className="mt-2 flex flex-col divide-y divide-(--vq-line-2)">
        {handoffs.map((handoff) => {
          const from = handoff.fromAgent ? getAgent(handoff.fromAgent.toLowerCase()) : null
          const action = handoff.requestedActionId
            ? findAction(handoff.requestedActionId as AgentActionId)
            : undefined

          return (
            <li key={handoff.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {from?.name ?? "You"} asked for{" "}
                  <span className="font-medium">{action?.label ?? "help"}</span>
                </p>
                {handoff.note && (
                  <p className="truncate text-xs text-muted-foreground">{handoff.note}</p>
                )}
              </div>

              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  disabled={respond.isPending}
                  onClick={async () => {
                    await respond.mutateAsync({ id: handoff.id, action: "accept" })
                    // Open the requested action prefilled, if one was named.
                    // Without an action there is nothing to open, and the note
                    // is the whole instruction.
                    if (handoff.requestedActionId) {
                      openAction(
                        handoff.requestedActionId as AgentActionId,
                        handoff.requestedArgs ?? undefined,
                      )
                    }
                  }}
                >
                  {action ? "Accept and open" : "Accept"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: handoff.id, action: "decline" })}
                >
                  Decline
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
