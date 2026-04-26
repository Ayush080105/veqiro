"use client"

import * as React from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ZodType } from "zod"

/**
 * Standard hook for agent forms (parent-controlled value, internal RHF).
 *
 * The parent owns the value across renders and passes `value` + `onChange(patch)`.
 * Internally we run useForm with zodResolver and forward every form change back
 * to the parent via `form.watch(callback)` (subscription, no re-renders).
 *
 * Validation errors appear inline (Field/FieldError); parent's submit gate is
 * unaffected — when the user clicks Run, the parent reads its current value.
 */
export function useAgentForm<TValues extends Record<string, unknown>>({
  schema,
  defaultValue,
  onChange,
}: {
  // Permissive schema parameter; the form is typed by TValues. We trust callers
  // to pair a schema whose output matches TValues (zod 4 generics + RHF generics
  // are over-strict here, so we relax with any).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodType<any>
  defaultValue: TValues
  onChange: (patch: Partial<TValues>) => void
}): UseFormReturn<TValues> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolver = zodResolver(schema as any) as any
  const form = useForm<TValues>({
    resolver,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValues: defaultValue as any,
    mode: "onBlur",
  })

  const onChangeRef = React.useRef(onChange)
  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  React.useEffect(() => {
    const sub = form.watch((v) => {
      // Strip undefined so unregistered fields don't overwrite valid parent state
      const patch = Object.fromEntries(
        Object.entries(v as Record<string, unknown>).filter(([, val]) => val !== undefined)
      ) as Partial<TValues>
      onChangeRef.current(patch)
    })
    return () => sub.unsubscribe()
  }, [form])

  return form
}
