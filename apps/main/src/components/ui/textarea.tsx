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
          "min-h-24 rounded-md border-[3px] border-foreground bg-secondary px-4 py-3 text-base font-body resize-y transition-shadow focus-visible:shadow-[4px_4px_0_var(--destructive)] aria-invalid:border-destructive aria-invalid:shadow-[4px_4px_0_var(--destructive)]",
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
