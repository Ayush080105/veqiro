"use client"

import * as React from "react"
import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface RhfFieldRenderProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> {
  field: ControllerRenderProps<TValues, TName>
  invalid: boolean
  id: string
}

interface RhfFieldProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> {
  control: Control<TValues>
  name: TName
  label?: React.ReactNode
  description?: React.ReactNode
  required?: boolean
  className?: string
  children: (props: RhfFieldRenderProps<TValues, TName>) => React.ReactNode
}

/**
 * Single Controller wrapper for the RHF + zod + shadcn-Field pattern.
 * Renders Field > Label (brand) > children > FieldDescription | FieldError.
 */
export function RhfField<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
>({
  control,
  name,
  label,
  description,
  required,
  className,
  children,
}: RhfFieldProps<TValues, TName>) {
  const id = `rhf-${String(name)}`
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={cn(className)}>
          {label && (
            <Label variant="brand" htmlFor={id}>
              {label}
              {required && <span className="ml-0.5 text-destructive">*</span>}
            </Label>
          )}
          {children({ field, invalid: fieldState.invalid, id })}
          {description && !fieldState.error && (
            <FieldDescription>{description}</FieldDescription>
          )}
          {fieldState.error && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
