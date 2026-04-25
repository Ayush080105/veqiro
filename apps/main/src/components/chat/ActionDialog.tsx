"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AgentNotAvailableError, runAgentAction } from "@/lib/api/assistants"
import type { AgentActionId } from "@/lib/types/agents"

export interface ActionResultContext<TInput, TResult> {
  actionId: AgentActionId
  input: TInput
  result: TResult
}

export interface ActionFormProps<TInput, TResult> {
  /** Current form state */
  value: TInput
  /** Merge into state */
  onChange: (patch: Partial<TInput>) => void
  /** Submit the form. Returns the API result, throws on error. */
  submit: () => Promise<TResult>
  submitting: boolean
}

export interface ActionDialogProps<TInput, TResult> {
  open: boolean
  onOpenChange: (v: boolean) => void
  actionId: AgentActionId
  title: string
  description?: string
  organizationId: string
  conversationId?: string
  defaultValue: TInput
  /** Validates form state. Return null if valid, or a message if not. */
  validate?: (value: TInput) => string | null
  /** Render the form body. Use ActionFormProps callbacks. */
  renderForm: (props: ActionFormProps<TInput, TResult>) => React.ReactNode
  /** Called with successful result. Usually pushes a rich message to chat. */
  onComplete: (ctx: ActionResultContext<TInput, TResult>) => void
  /** Override the default JSON `runAgentAction` submit (e.g. for multipart uploads). */
  customSubmit?: (value: TInput, organizationId: string) => Promise<TResult>
  submitLabel?: string
}

export function ActionDialog<TInput, TResult>({
  open,
  onOpenChange,
  actionId,
  title,
  description,
  organizationId,
  conversationId,
  defaultValue,
  validate,
  renderForm,
  onComplete,
  customSubmit,
  submitLabel = "Run",
}: ActionDialogProps<TInput, TResult>) {
  const [value, setValue] = React.useState<TInput>(defaultValue)
  const [submitting, setSubmitting] = React.useState(false)

  // Reset on open
  React.useEffect(() => {
    if (open) setValue(defaultValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, actionId])

  const onChange = React.useCallback((patch: Partial<TInput>) => {
    setValue((prev) => ({ ...(prev as object), ...patch } as TInput))
  }, [])

  const submit = React.useCallback(async (): Promise<TResult> => {
    if (validate) {
      const err = validate(value)
      if (err) {
        toast.error(err)
        throw new Error(err)
      }
    }
    setSubmitting(true)
    try {
      const result = customSubmit
        ? await customSubmit(value, organizationId)
        : await runAgentAction<TInput, TResult>(
            actionId,
            organizationId,
            value,
            conversationId
          )
      onComplete({ actionId, input: value, result })
      onOpenChange(false)
      return result
    } catch (err) {
      if (err instanceof AgentNotAvailableError) {
        toast.error(err.message)
      } else {
        toast.error(err instanceof Error ? err.message : "Action failed.")
      }
      throw err
    } finally {
      setSubmitting(false)
    }
  }, [value, actionId, organizationId, conversationId, validate, onComplete, onOpenChange, customSubmit])

  const handleSubmit = () => {
    submit().catch(() => {
      /* toast already fired */
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {renderForm({ value, onChange, submit, submitting })}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Running…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
