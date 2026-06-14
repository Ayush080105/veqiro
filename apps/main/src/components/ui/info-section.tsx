import * as React from "react"

import { cn } from "@/lib/utils"
import { Kicker } from "@/components/ui/kicker"

interface InfoItem {
  title: React.ReactNode
  subtitle?: React.ReactNode
  meta?: React.ReactNode
}

interface InfoSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  /** When provided, renders as a rich list with title/subtitle/meta per row. */
  items?: InfoItem[]
  /** When provided, renders a plain bullet list (one string per line). */
  bullets?: React.ReactNode[]
  /** Plain-text markdown-ish body (line breaks preserved). */
  markdown?: string
  /** When provided, renders as a numbered list. */
  ordered?: React.ReactNode[]
  /** Tone tweaks: "danger" colors the kicker red (e.g. for anomalies). */
  tone?: "default" | "danger" | "muted"
  className?: string
  children?: React.ReactNode
}

export function InfoSection({
  label,
  items,
  bullets,
  ordered,
  markdown,
  tone = "default",
  className,
  children,
  ...rest
}: InfoSectionProps) {
  const kickerTone = tone === "danger" ? "ink" : "ink"
  return (
    <section className={cn("flex flex-col gap-1.5", className)} {...rest}>
      <Kicker
        prefix="//"
        tone={kickerTone}
        className={cn(tone === "danger" && "text-destructive")}
      >
        {label}
      </Kicker>
      {markdown && (
        <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-foreground">
          {markdown}
        </p>
      )}
      {bullets && bullets.length > 0 && (
        <ul className="m-0 list-disc pl-4 text-xs leading-relaxed">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {ordered && ordered.length > 0 && (
        <ol className="m-0 list-decimal pl-4 text-xs leading-relaxed">
          {ordered.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ol>
      )}
      {items && items.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 border-l-2 border-foreground/20 pl-2 text-sm leading-snug"
            >
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium text-foreground">{item.title}</span>
                {item.subtitle && (
                  <span className="text-[11px] text-muted-foreground">
                    {item.subtitle}
                  </span>
                )}
              </div>
              {item.meta && (
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {item.meta}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {children}
    </section>
  )
}
