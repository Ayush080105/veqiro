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

export interface ActionStage {
  label: string
  data?: unknown
}

export interface ActionFormProps<TInput, TResult> {
  /** Current form state */
  value: TInput
  /** Merge into state */
  onChange: (patch: Partial<TInput>) => void
  /** Submit the form. Returns the API result, throws on error. */
  submit: () => Promise<TResult>
  submitting: boolean
  /** Interim progress reported by a multi-step customSubmit (e.g. "Generating storyboard…"). */
  stage?: ActionStage | null
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
  /** Override the default JSON `runAgentAction` submit (e.g. for multipart uploads). Receives
   * an `onStage` callback for multi-step submits to report interim progress (e.g. a storyboard
   * step before the final result) — call it with `null` to clear the banner. */
  customSubmit?: (
    value: TInput,
    organizationId: string,
    conversationId?: string,
    onStage?: (stage: ActionStage | null) => void
  ) => Promise<TResult>
  submitLabel?: string
  /** Optionally resolve a different actionId based on current form value (e.g. carousel routing). */
  resolveActionId?: (value: TInput) => AgentActionId
  /** Called whenever the submitting state changes so the parent can show a loader. */
  onSubmittingChange?: (submitting: boolean) => void
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
  onSubmittingChange,
}: ActionDialogProps<TInput, TResult>) {
  const [value, setValue] = React.useState<TInput>(defaultValue)
  const [submitting, setSubmitting] = React.useState(false)
  const [stage, setStage] = React.useState<ActionStage | null>(null)

  // Reset on open
  React.useEffect(() => {
    if (open) setValue(defaultValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, actionId])

  const onChange = React.useCallback((patch: Partial<TInput>) => {
    setValue((prev) => ({ ...(prev as object), ...patch } as TInput))
  }, [])

  const setSubmittingWithNotify = React.useCallback(
    (v: boolean) => {
      setSubmitting(v)
      onSubmittingChange?.(v)
    },
    [onSubmittingChange],
  )

  const submit = React.useCallback(async (): Promise<TResult> => {
    const submittedValue = value
    if (validate) {
      const err = validate(submittedValue)
      if (err) {
        toast.error(err)
        throw new Error(err)
      }
    }
    
    setSubmittingWithNotify(true)
    setStage(null)
    const effectiveActionId = resolveActionId ? resolveActionId(submittedValue) : actionId

    onStart?.({ actionId: effectiveActionId, input: submittedValue })

    try {
      const result = customSubmit
        ? await customSubmit(submittedValue, organizationId, conversationId, setStage)
        : await runAgentAction<TInput, TResult>(
            effectiveActionId,
            organizationId,
            submittedValue,
            conversationId
          )

      onComplete({ actionId: effectiveActionId, input: submittedValue, result })
      onOpenChange(false) // Modal closes only after a successful completion
      return result
    } catch (err) {
      if (err instanceof AgentNotAvailableError) {
        toast.error(err.message)
      } else {
        toast.error(err instanceof Error ? err.message : "Action failed.")
      }
      throw err
    } finally {
      onSettled?.({ actionId: effectiveActionId, input: submittedValue })
      setSubmittingWithNotify(false)
      setStage(null)
    }
  }, [
    value,
    actionId,
    resolveActionId,
    organizationId,
    conversationId,
    validate,
    onComplete,
    onOpenChange,
    customSubmit,
    setSubmittingWithNotify,
    onStart,
    onSettled
  ])

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
      {/* flex + max-h so tall forms scroll inside the dialog and the footer stays visible */}
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]" onKeyDown={handleKeyDown}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto min-h-0 pr-1">
          {renderForm({ value, onChange, submit, submitting, stage })}
        </div>
        <DialogFooter className="flex-shrink-0">
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