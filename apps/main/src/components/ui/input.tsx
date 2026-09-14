import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "w-full min-w-0 outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 file:inline-flex file:border-0 file:bg-transparent file:font-medium file:text-foreground",
  {
    variants: {
      variant: {
        default:
          "h-9 rounded-[var(--vq-r-sm)] border border-input bg-background px-3 py-1 text-sm file:h-7 file:text-xs transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:bg-muted/50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        brand:
          "h-10 rounded-[var(--vq-r-sm)] border border-input bg-background px-3 py-2 text-sm font-body file:h-7 file:text-xs transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:bg-input/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type InputProps = React.ComponentProps<"input"> & VariantProps<typeof inputVariants>

function Input({ className, type, variant, ...props }: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
