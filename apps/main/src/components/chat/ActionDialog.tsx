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

export interface ActionStartContext<TInput> {
  actionId: AgentActionId
  input: TInput
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
  /** Called after validation passes and before the API request starts. */
  onStart?: (ctx: ActionStartContext<TInput>) => void
  /** Called when the API request settles, successfully or with an error. */
  onSettled?: (ctx: ActionStartContext<TInput>) => void
  /** Override the default JSON `runAgentAction` submit (e.g. for multipart uploads). */
  customSubmit?: (value: TInput, organizationId: string) => Promise<TResult>
  submitLabel?: string
  /** Optionally resolve a different actionId based on current form value (e.g. carousel routing). */
  resolveActionId?: (value: TInput) => AgentActionId
  
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
  onStart,
  onSettled,
  customSubmit,
  submitLabel = "Run",
  resolveActionId,
}: ActionDialogProps<TInput, TResult>) {
  const [value, setValue] = React.useState<TInput>(defaultValue)
  const [submitting, setSubmitting] = React.useState(false)

  // Always keep a ref in sync so submit() never reads a stale closure value.
  const latestValueRef = React.useRef<TInput>(defaultValue)
  latestValueRef.current = value

  // Reset on open
  React.useEffect(() => {
    if (open) setValue(defaultValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, actionId])

  const onChange = React.useCallback((patch: Partial<TInput>) => {
    setValue((prev) => ({ ...(prev as object), ...patch } as TInput))
  }, [])

  const submit = React.useCallback(async (): Promise<TResult> => {
    // Read from ref so we always get the latest value, even if the closure is stale.
    const currentValue = latestValueRef.current
    if (validate) {
      const err = validate(currentValue)
      if (err) {
        toast.error(err)
        throw new Error(err)
      }
    }
    setSubmitting(true)
    const effectiveActionId = resolveActionId ? resolveActionId(currentValue) : actionId
    onStart?.({ actionId, input: currentValue })
    onOpenChange(false)
    try {
      const result = customSubmit
        ? await customSubmit(currentValue, organizationId)
        : await runAgentAction<TInput, TResult>(
            effectiveActionId,
            organizationId,
            currentValue,
            conversationId
          )
      onComplete({ actionId: effectiveActionId, input: currentValue, result })
      return result
    } catch (err) {
      if (err instanceof AgentNotAvailableError) {
        toast.error(err.message)
      } else {
        toast.error(err instanceof Error ? err.message : "Action failed.")
      }
      throw err
    } finally {
      onSettled?.({ actionId, input: currentValue })
      setSubmitting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionId, resolveActionId, organizationId, conversationId, validate, onStart, onComplete, onSettled, onOpenChange, customSubmit])

  const handleSubmit = () => {
    submit().catch(() => {
      /* toast already fired */
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return
    if ((e.target as HTMLElement).closest("button")) return
    e.preventDefault()
    if (!submitting) handleSubmit()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
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
