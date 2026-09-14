import * as React from "react"

import { cn } from "@/lib/utils"

type LegacySticker = { label: string; rot?: number; color?: string }
type StickerProp = React.ReactNode | LegacySticker

interface PageHeaderProps {
  title: React.ReactNode
  kicker?: string
  subtitle?: React.ReactNode
  sticker?: StickerProp
  right?: React.ReactNode
  className?: string
  size?: "md" | "lg"
}

export function PageHeader({
  title,
  subtitle,
  right,
  className,
  size = "lg",
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h1
          className={cn(
            "m-0 font-head leading-tight tracking-normal text-foreground",
            size === "lg" && "text-[clamp(2rem,3vw,2.75rem)]",
            size === "md" && "text-3xl"
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="m-0 max-w-2xl font-body text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {right && (
        <div className="flex w-full shrink-0 flex-wrap items-start gap-3 sm:w-auto sm:justify-end">
          {right}
        </div>
      )}
    </header>
  )
}
