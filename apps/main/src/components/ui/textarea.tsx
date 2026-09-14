import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const textareaVariants = cva(
  "flex field-sizing-content w-full outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "min-h-20 rounded-[var(--vq-r-sm)] border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:bg-muted/50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        brand:
          "min-h-24 resize-y rounded-[var(--vq-r-sm)] border border-input bg-background px-3 py-2 text-sm font-body transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:bg-input/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type TextareaProps = React.ComponentProps<"textarea"> & VariantProps<typeof textareaVariants>

function Textarea({ className, variant, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Textarea, textareaVariants }
