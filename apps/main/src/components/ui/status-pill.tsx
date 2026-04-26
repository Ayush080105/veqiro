import * as React from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
} from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Compact status pill with leading icon. Built on shared classes — does not wrap Badge
// because we want the icon to sit inline with consistent sizing.
const statusPillVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-foreground px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      level: {
        info: "bg-card text-foreground",
        ok: "bg-[color:var(--vq-green)]/15 text-foreground",
        warn: "bg-accent text-foreground",
        danger: "bg-destructive text-foreground",
      },
    },
    defaultVariants: {
      level: "info",
    },
  }
)

const ICON_FOR_LEVEL = {
  info: Info,
  ok: CheckCircle2,
  warn: AlertTriangle,
  danger: ShieldAlert,
} as const

type Level = keyof typeof ICON_FOR_LEVEL

interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  level?: Level
  /** Override the default icon for this level. Pass `null` to hide. */
  icon?: React.ReactNode | null
  children: React.ReactNode
}

export function StatusPill({
  level = "info",
  icon,
  className,
  children,
  ...rest
}: StatusPillProps) {
  const DefaultIcon = ICON_FOR_LEVEL[level]
  const iconNode = icon === undefined ? <DefaultIcon /> : icon
  return (
    <span className={cn(statusPillVariants({ level }), className)} {...rest}>
      {iconNode}
      <span>{children}</span>
    </span>
  )
}
