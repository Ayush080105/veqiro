"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "flex items-center gap-2 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "text-xs leading-none",
        // ── Veqiro brand variants ────────────────────────────────────────────
        // "kicker" = mono uppercase tag used as section headers and form labels.
        kicker:
          "font-mono text-[11px] uppercase tracking-[0.18em] leading-none text-muted-foreground",
        brand:
          "font-mono text-[11px] uppercase tracking-[0.18em] leading-none text-foreground/70 mb-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type LabelProps = React.ComponentProps<"label"> & VariantProps<typeof labelVariants>

function Label({ className, variant, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn(labelVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Label, labelVariants }
