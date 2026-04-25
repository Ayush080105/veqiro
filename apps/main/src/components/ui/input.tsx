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
          "h-8 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs file:h-6 file:text-xs transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-xs dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        // ── Veqiro brand variant ─────────────────────────────────────────────
        // Chunky cream input with 3px ink border, body font, focus-shadow press.
        brand:
          "h-12 rounded-md border-[3px] border-foreground bg-secondary px-4 py-3 text-base font-body file:h-8 file:text-sm transition-shadow focus-visible:shadow-[4px_4px_0_var(--destructive)] aria-invalid:border-destructive aria-invalid:shadow-[4px_4px_0_var(--destructive)]",
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
