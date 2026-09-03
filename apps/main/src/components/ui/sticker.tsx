import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Flat accent pill. Color is a restrained tint (12-15% mix), not a full-bleed
// fill — matches the landing page's "accent colours reserved for signal" rule.
const stickerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[var(--vq-line-2)] px-3.5 py-1.5 font-body text-xs font-medium text-foreground",
  {
    variants: {
      tone: {
        yellow: "bg-[color-mix(in_srgb,var(--vq-yellow)_16%,var(--card))]",
        red: "bg-[color-mix(in_srgb,var(--vq-red)_14%,var(--card))]",
        green: "bg-[color-mix(in_srgb,var(--vq-green)_14%,var(--card))]",
        violet: "bg-[color-mix(in_srgb,var(--vq-violet)_14%,var(--card))]",
        blue: "bg-[color-mix(in_srgb,var(--vq-blue)_14%,var(--card))]",
        pink: "bg-[color-mix(in_srgb,var(--vq-pink)_14%,var(--card))]",
        cream: "bg-card",
      },
    },
    defaultVariants: {
      tone: "yellow",
    },
  }
)

interface StickerProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof stickerVariants> {
  /** @deprecated No longer applied — stickers sit flat now. Kept so existing call sites don't need to change. */
  rotate?: number
  children: React.ReactNode
}

export function Sticker({
  tone,
  className,
  children,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarded: rotation is retired, kept in the prop type so call sites don't need to change
  rotate,
  ...rest
}: StickerProps) {
  return (
    <span className={cn(stickerVariants({ tone }), className)} {...rest}>
      {children}
    </span>
  )
}
