import * as React from "react"

interface StepShellProps {
  emoji?: string
  title: string
  subtitle?: string
  /** Override the cream default — used for the review step. */
  bg?: string
  children: React.ReactNode
}

/**
 * Visual frame for every onboarding step. Cream sticker-card with the step
 * emoji + display title + body subtitle. Children render below.
 */
export function StepShell({ emoji, title, subtitle, bg, children }: StepShellProps) {
  return (
    <div
      className="mx-auto max-w-2xl rounded-2xl border-[3px] border-foreground p-10 shadow-[10px_10px_0_var(--foreground)]"
      style={{ background: bg ?? "#FFF9ED" }}
    >
      <div className="mb-2 flex items-center gap-3">
        {emoji && (
          <div className="grid size-12 -rotate-6 place-items-center rounded-xl border-[3px] border-foreground bg-[color:var(--vq-yellow)] font-display text-2xl shadow-[3px_3px_0_var(--foreground)]">
            {emoji}
          </div>
        )}
        <h2 className="m-0 font-display text-[44px] leading-none tracking-[-0.02em] text-foreground">
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="mb-6 mt-0 font-body text-base leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      )}
      {children}
    </div>
  )
}
