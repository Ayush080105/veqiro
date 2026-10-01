"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { useAddMemoryItem, type MemoryKind, type MemoryScope } from "@/lib/api/workspace"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const KINDS: { value: MemoryKind; label: string; hint: string }[] = [
  { value: "fact", label: "Fact", hint: "Something true about your business" },
  { value: "preference", label: "Preference", hint: "How you like things done" },
  { value: "constraint", label: "Rule", hint: "Something it must never or always do" },
  { value: "decision", label: "Decision", hint: "Something you have settled" },
]

/**
 * Tell an employee something to remember.
 *
 * What goes in is the customer's own words, so it lands confirmed and outranks
 * anything the agent merely inferred — which is the reason to type it here
 * rather than hope it is picked up from a conversation.
 */
export function AddMemoryForm({ agent, agentName }: { agent: string; agentName: string }) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")
  const [kind, setKind] = useState<MemoryKind>("fact")
  const [scope, setScope] = useState<MemoryScope>("agent")
  const add = useAddMemoryItem(agent)

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="w-fit gap-1.5">
        <Plus className="size-4" /> Add to memory
      </Button>
    )
  }

  const submit = () => {
    if (content.trim().length < 3) return
    add.mutate(
      { content: content.trim(), kind, scope },
      {
        onSuccess: () => {
          setContent("")
          setOpen(false)
          toast.success(
            scope === "company" ? "Every employee will remember that." : `${agentName} will remember that.`,
          )
        },
        onError: () => toast.error("Couldn't save that. Try again."),
      },
    )
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-[var(--vq-r)] border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="memory-content" className="text-sm font-medium">
          What should {agentName} remember?
        </label>
        <Textarea
          id="memory-content"
          autoFocus
          rows={2}
          maxLength={500}
          value={content}
          placeholder="e.g. We never discount annual plans, and our fiscal year starts in April"
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs text-muted-foreground">It is a…</legend>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                title={k.hint}
                aria-pressed={kind === k.value}
                onClick={() => setKind(k.value)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (kind === k.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                {k.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs text-muted-foreground">Who should know?</legend>
          <div className="flex gap-1.5">
            {(
              [
                ["agent", `Just ${agentName}`],
                ["company", "Every employee"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={scope === value}
                onClick={() => setScope(value)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (scope === value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={add.isPending || content.trim().length < 3}>
          Remember this
        </Button>
      </div>
    </form>
  )
}
