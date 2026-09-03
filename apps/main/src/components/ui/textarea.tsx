import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const textareaVariants = cva(
  "flex field-sizing-content w-full outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "min-h-16 rounded-none border border-input bg-transparent px-2.5 py-2 text-xs transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-xs dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        // ── Veqiro brand variant ─────────────────────────────────────────────
        brand:
          "min-h-24 rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-secondary px-4 py-3 text-base font-body resize-y transition-shadow focus-visible:shadow-[var(--vq-shadow)] aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/30",
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
