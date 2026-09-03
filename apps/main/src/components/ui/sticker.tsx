import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Hand-drawn rotating pill sticker. Pure decoration — supports the brand voice.
const stickerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[var(--vq-line-2)] px-4 py-2 font-display text-xs font-medium text-foreground shadow-[var(--vq-shadow-sm)]",
  {
    variants: {
      tone: {
        yellow: "bg-accent",
        red: "bg-destructive",
        green: "bg-[color:var(--vq-green)]",
        violet: "bg-[color:var(--vq-violet)]",
        blue: "bg-[color:var(--vq-blue)]",
        pink: "bg-[color:var(--vq-pink)]",
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
  /** Rotation in degrees. Negative tilts left. */
  rotate?: number
  children: React.ReactNode
}

export function Sticker({
  rotate = -4,
  tone,
  className,
  children,
  style,
  ...rest
}: StickerProps) {
  return (
    <span
      className={cn(stickerVariants({ tone }), className)}
      style={{ transform: `rotate(${rotate}deg)`, ...style }}
      {...rest}
    >
      {children}
    </span>
  )
}
