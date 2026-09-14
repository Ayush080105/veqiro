"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "flex items-center gap-2 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "text-sm font-medium leading-none text-foreground",
        kicker:
          "text-xs font-medium leading-none text-muted-foreground",
        brand:
          "mb-1.5 text-sm font-medium leading-none text-foreground",
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
