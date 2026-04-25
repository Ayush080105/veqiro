import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Mono uppercase tag used as section/eyebrow labels: "// crew status".
// Decorative — when used as a heading, set `as="h2"`/`as="h3"` and add `aria-label` if needed.
const kickerVariants = cva(
  "inline-flex items-center gap-1 font-mono uppercase leading-none",
  {
    variants: {
      tone: {
        default: "text-muted-foreground",
        ink: "text-foreground",
        accent: "text-foreground",
      },
      size: {
        sm: "text-[10px] tracking-[0.18em]",
        md: "text-[11px] tracking-[0.18em]",
        lg: "text-xs tracking-[0.2em]",
      },
    },
    defaultVariants: {
      tone: "default",
      size: "md",
    },
  }
)

type KickerProps = Omit<React.HTMLAttributes<HTMLElement>, "prefix"> &
  VariantProps<typeof kickerVariants> & {
    /** Element to render. Defaults to <span>. */
    as?: "span" | "div" | "p" | "h2" | "h3" | "h4"
    /** Leading delimiter, default `//`. Pass `null` to omit. Pass `[ ` to use bracket style. */
    prefix?: React.ReactNode | null
    children: React.ReactNode
  }

export function Kicker({
  as: Component = "span",
  prefix = "//",
  tone,
  size,
  className,
  children,
  ...rest
}: KickerProps) {
  return (
    <Component className={cn(kickerVariants({ tone, size }), className)} {...rest}>
      {prefix !== null && (
        <span aria-hidden className="opacity-60">
          {prefix}
        </span>
      )}
      {children}
    </Component>
  )
}
