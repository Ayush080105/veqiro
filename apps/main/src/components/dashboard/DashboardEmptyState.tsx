"use client"

import type { ComponentType } from "react"
import Link from "next/link"
import type { LucideProps } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  tone = "neutral",
  framed = true,
  className,
}: {
  icon: ComponentType<LucideProps>
  title: string
  description: string
  action?: { label: string; href?: string; onClick?: () => void }
  compact?: boolean
  tone?: "neutral" | "danger"
  framed?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        framed && "rounded-[var(--vq-r-sm)] border border-dashed bg-muted/30",
        framed && (compact ? "px-3.5 py-3" : "px-4 py-5"),
        framed && (tone === "danger" ? "border-destructive/45 bg-destructive/5" : "border-border"),
        !framed && "p-0",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-[var(--vq-r-sm)] border border-border bg-card">
          <Icon className={cn("size-4", tone === "danger" ? "text-destructive" : "text-muted-foreground")} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <p className="m-0 mt-1 text-xs leading-snug text-muted-foreground">{description}</p>
          {action && (
            <div className="mt-3 flex justify-start sm:justify-end">
              {action.href ? (
                <Button asChild variant={tone === "danger" ? "outline" : "brand-dark"} size="brand-sm">
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ) : action.onClick ? (
                <Button variant={tone === "danger" ? "outline" : "brand-dark"} size="brand-sm" onClick={action.onClick}>
                  {action.label}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
