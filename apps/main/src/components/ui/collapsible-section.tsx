"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  defaultOpen?: boolean
  className?: string
  triggerClassName?: string
  contentClassName?: string
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  subtitle,
  badge,
  defaultOpen,
  className,
  triggerClassName,
  contentClassName,
  children,
}: CollapsibleSectionProps) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn(
        "group/cs flex flex-col gap-2 border border-foreground/10 bg-card/50",
        className
      )}
    >
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40 [&[data-panel-open]_svg.cs-chevron]:rotate-180",
          triggerClassName
        )}
      >
        <ChevronDown className="cs-chevron size-3.5 shrink-0 text-muted-foreground transition-transform" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs font-medium text-foreground">{title}</span>
          {subtitle && (
            <span className="text-[11px] text-muted-foreground">{subtitle}</span>
          )}
        </div>
        {badge && <span className="ml-auto">{badge}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "border-t border-foreground/10 px-3 py-2",
          contentClassName
        )}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
