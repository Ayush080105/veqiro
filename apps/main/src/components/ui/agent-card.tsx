"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

interface AgentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** "brand" = chunky cream + 3px ink + hard shadow. "default" = compact shadcn card. */
  variant?: "default" | "brand"
  size?: "default" | "sm"
  className?: string
  children: React.ReactNode
}

interface AgentCardHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode
  /** Small mono kicker rendered before the title. */
  kicker?: React.ReactNode
  title: React.ReactNode
  /** Optional badge / status pill on the trailing edge. */
  badge?: React.ReactNode
  /** Custom right-side content (overrides badge if both present). */
  right?: React.ReactNode
  className?: string
}

function AgentCardRoot({
  variant = "default",
  size = "default",
  className,
  children,
  ...rest
}: AgentCardProps) {
  return (
    <Card
      variant={variant}
      size={size}
      className={cn(variant === "brand" && "px-4", className)}
      {...rest}
    >
      {children}
    </Card>
  )
}

function AgentCardHeader({
  icon,
  kicker,
  title,
  badge,
  right,
  className,
  ...rest
}: AgentCardHeaderProps) {
  return (
    <div
      data-slot="agent-card-header"
      className={cn(
        "flex items-center gap-2 px-4 group-data-[size=sm]/card:px-3",
        className
      )}
      {...rest}
    >
      {icon && (
        <span className="shrink-0 text-muted-foreground [&_svg]:size-3.5">{icon}</span>
      )}
      {kicker && (
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {kicker}
        </span>
      )}
      <p className="text-xs font-medium text-foreground">{title}</p>
      {(right || badge) && <span className="ml-auto">{right ?? badge}</span>}
    </div>
  )
}

function AgentCardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="agent-card-body"
      className={cn("px-4 group-data-[size=sm]/card:px-3", className)}
      {...props}
    />
  )
}

function AgentCardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="agent-card-footer"
      className={cn(
        "flex flex-wrap items-center justify-end gap-1.5 px-4 group-data-[size=sm]/card:px-3",
        className
      )}
      {...props}
    />
  )
}

export const AgentCard = Object.assign(AgentCardRoot, {
  Header: AgentCardHeader,
  Body: AgentCardBody,
  Footer: AgentCardFooter,
})
