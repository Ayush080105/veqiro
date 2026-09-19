"use client"

import { useState } from "react"
import { toast } from "sonner"

import { useCreateHandoff } from "@/lib/api/workspace"
import { AGENTS } from "@/lib/config/agents"
import { AGENT_ACTIONS } from "@/lib/agents/actions"
import type { AgentSlug } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAgentWorkspace } from "../AgentWorkspaceContext"

/**
 * Hand a piece of work to another employee.
 *
 * The PRD's handoff carries context, a source object, a requested outcome and
 * an expected output — so this asks for the receiving employee, optionally the
 * action to run, and a note. It does NOT run anything: the receiving agent's
 * overview shows the request and a human decides. Auto-executing on receipt
 * would be inventing autonomy the customer never granted.
 */
export function DelegateDialog({
  open,
  onOpenChange,
  objectKind,
  objectId,
  defaultNote,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  objectKind?: string
  objectId?: string
  defaultNote?: string
}) {
  const { agent, organizationId } = useAgentWorkspace()
  const create = useCreateHandoff(organizationId)

  // Everyone except the employee doing the handing over.
  const targets = AGENTS.filter((candidate) => candidate.id !== agent)

  const [toAgent, setToAgent] = useState<AgentSlug>(targets[0]!.id as AgentSlug)
  const [actionId, setActionId] = useState<string>("__none")
  const [note, setNote] = useState(defaultNote ?? "")

  const actions = (AGENT_ACTIONS[toAgent] ?? []).filter((a) => !a.hideFromMenu && !a.locked)

  const submit = async () => {
    try {
      await create.mutateAsync({
        fromAgent: agent.toUpperCase(),
        toAgent: toAgent.toUpperCase(),
        requestedActionId: actionId === "__none" ? undefined : actionId,
        note: note.trim() || undefined,
        objectKind,
        objectId,
      })
      toast.success(`Handed to ${targets.find((t) => t.id === toAgent)?.name ?? toAgent}.`)
      onOpenChange(false)
      setNote("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not hand that over.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hand this to another employee</DialogTitle>
          <DialogDescription>
            They&apos;ll see it on their overview. Nothing runs until someone says so.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="handoff-agent">Who</Label>
            <Select
              value={toAgent}
              onValueChange={(value) => {
                setToAgent(value as AgentSlug)
                // The previous action belonged to the previous employee.
                setActionId("__none")
              }}
            >
              <SelectTrigger id="handoff-agent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    {target.name} — {target.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {actions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="handoff-action">What to do (optional)</Label>
              <Select
                value={actionId}
                onValueChange={(value) => setActionId(value ?? "__none")}
              >
                <SelectTrigger id="handoff-action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Let them decide</SelectItem>
                  {actions.map((action) => (
                    <SelectItem key={action.id} value={action.id}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="handoff-note">Context</Label>
            <Textarea
              id="handoff-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What you want out of this, and anything they need to know."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={create.isPending}>
            Hand it over
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
