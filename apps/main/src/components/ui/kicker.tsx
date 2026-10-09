import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Small uppercase section label, like an iOS grouped-list header: "Crew status".
// Decorative — when used as a heading, set `as="h2"`/`as="h3"` and add `aria-label` if needed.
const kickerVariants = cva(
  "inline-flex items-center gap-1 font-body font-semibold uppercase leading-none",
  {
    variants: {
      tone: {
        default: "text-muted-foreground",
        ink: "text-foreground",
        accent: "text-foreground",
      },
      size: {
        sm: "text-[10px] tracking-[0.06em]",
        md: "text-[11px] tracking-[0.06em]",
        lg: "text-xs tracking-[0.05em]",
      },
    },
    defaultVariants: {
      tone: "ink",
      size: "md",
    },
  }
)

type KickerProps = Omit<React.HTMLAttributes<HTMLElement>, "prefix"> &
  VariantProps<typeof kickerVariants> & {
    /** Element to render. Defaults to <span>. */
    as?: "span" | "div" | "p" | "h2" | "h3" | "h4"
    /** Optional leading delimiter (e.g. `//`). None by default. */
    prefix?: React.ReactNode | null
    children: React.ReactNode
  }

export function Kicker({
  as: Component = "span",
  prefix = null,
  tone,
  size,
  className,
  children,
  ...rest
}: KickerProps) {
  return (
    <Component className={cn(kickerVariants({ tone, size }), className)} {...rest}>
      {prefix != null && (
        <span aria-hidden className="opacity-40">
          {prefix}
        </span>
      )}
      {children}
    </Component>
  )
}
