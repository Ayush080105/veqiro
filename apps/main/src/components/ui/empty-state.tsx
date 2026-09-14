import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface EmptyStateAction {
  label: string
  onClick?: () => void
  href?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
}

interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: EmptyStateAction
  /** "card" wraps content in a brand card; "plain" renders inline. */
  tone?: "card" | "plain"
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "card",
  className,
  ...rest
}: EmptyStateProps) {
  const inner = (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-6 py-10 text-center",
        tone === "plain" && className
      )}
    >
      {icon && (
        <span className="grid size-10 place-items-center rounded-[var(--vq-r-sm)] border border-border bg-muted/35 text-muted-foreground [&_svg]:size-5">
          {icon}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <h3 className="m-0 font-head text-xl leading-tight tracking-normal text-foreground">
          {title}
        </h3>
        {description && (
          <p className="m-0 max-w-sm font-body text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="mt-2">
          {action.href ? (
            <Button asChild variant={action.variant ?? "brand"} size="brand-sm">
              <a href={action.href}>{action.label}</a>
            </Button>
          ) : (
            <Button variant={action.variant ?? "brand"} size="brand-sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )

  if (tone === "plain") return inner

  return (
    <Card className={cn(className)} {...rest}>
      {inner}
    </Card>
  )
}
