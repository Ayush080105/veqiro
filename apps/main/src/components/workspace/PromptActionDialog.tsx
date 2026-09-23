"use client"

import { useState } from "react"

import { findAction } from "@/lib/agents/actions"
import {
  PROMPT_ACTIONS,
  isPromptAction,
  validatePromptAction,
} from "@/lib/agents/prompt-actions"
import type { AgentActionId } from "@/lib/types/agents"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  actionId: AgentActionId
  prefill?: Record<string, unknown>
  onClose: () => void
  /** Receives the finished request; the caller sends it to the chat. */
  onSubmit: (prompt: string) => void
}

/**
 * The form for an action that is a request to the agent's chat rather than an
 * endpoint (see lib/agents/prompt-actions.ts). Keyed by action id at the call
 * site so switching actions resets the fields.
 */
export function PromptActionDialog({ actionId, prefill, onClose, onSubmit }: Props) {
  const meta = findAction(actionId)
  const spec = isPromptAction(actionId) ? PROMPT_ACTIONS[actionId] : undefined

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const f of spec?.fields ?? []) {
      const pre = prefill?.[f.name]
      initial[f.name] = typeof pre === "string" ? pre : (f.defaultValue ?? "")
    }
    return initial
  })
  const [error, setError] = useState<string | null>(null)

  if (!meta || !spec) return null

  const set = (name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }))
    setError(null)
  }

  const submit = () => {
    const problem = validatePromptAction(spec, values)
    if (problem) return setError(problem)
    onSubmit(spec.build(values))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{meta.label}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          {spec.fields.map((f) => {
            const id = `prompt-${actionId}-${f.name}`
            return (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={id}>
                  {f.label}
                  {!f.required && <span className="text-muted-foreground"> (optional)</span>}
                </Label>
                {f.kind === "textarea" ? (
                  <Textarea
                    id={id}
                    rows={4}
                    value={values[f.name] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                ) : f.kind === "select" ? (
                  <select
                    id={id}
                    value={values[f.name] ?? ""}
                    onChange={(e) => set(f.name, e.target.value)}
                    className="h-9 w-full border border-border bg-background px-2 text-sm"
                  >
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={id}
                    value={values[f.name] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                )}
              </div>
            )
          })}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            This goes to the chat, where Vega does it. Anything that sends or creates asks you first.
          </p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{spec.submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
