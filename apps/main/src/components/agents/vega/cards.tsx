"use client"

import { Sunrise } from "lucide-react"

import { MarkdownMessage } from "@/components/chat/MarkdownMessage"
import { StatusPill } from "@/components/ui/status-pill"

export interface BriefingResult {
  headline: string
  body: string
  needsYou: number
  generatedAt: string
}

/**
 * Vega's executive briefing.
 *
 * The headline is computed from the workspace tables, not written by the
 * model — "4 things need your attention" has to be a number that is actually
 * true, because it is the line the customer will act on. The body is the
 * narrative around it.
 */
export function VegaBriefingCard({ result }: { result: BriefingResult }) {
  if (!result?.body) return null

  return (
    <div className="rounded-[var(--vq-r)] border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-[var(--vq-r-sm)] bg-muted">
          <Sunrise className="size-4 text-muted-foreground" />
        </span>
        <h3 className="min-w-0 flex-1 truncate font-head text-sm">{result.headline}</h3>
        {result.needsYou > 0 && (
          <StatusPill level="warn" className="shrink-0">
            {result.needsYou} waiting
          </StatusPill>
        )}
      </div>

      <div className="mt-3 text-sm">
        <MarkdownMessage content={result.body} />
      </div>
    </div>
  )
}
