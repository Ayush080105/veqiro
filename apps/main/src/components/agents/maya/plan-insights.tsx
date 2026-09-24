"use client"

import type { ReactNode } from "react"
import { CalendarDays, Info, Newspaper, Trophy, TrendingUp } from "lucide-react"

import type {
  ContentFormat,
  ContentPlan,
  ContentPlanItem,
  PlanSignal,
  PlanSignalKind,
} from "@/lib/api/assistants"

/**
 * The analysis half of a content plan: what Maya found, and how much of the week
 * rests on it.
 *
 * The calendar shows the plan; this shows why. It reads structured `signals`
 * when the plan has them — real numbers Maya read this run, so every bar is a
 * measurement — and falls back to a tidied version of the prose note for plans
 * made before signals existed.
 *
 * Colour: post vs reel are the two categories, drawn from --vq-chart-post /
 * --vq-chart-reel (validated for colour-blind separation in both themes, unlike
 * the brand blue and violet). Text always wears text tokens; colour only marks
 * identity, and every mark also carries a visible label.
 */

export const FORMAT_COLOR: Record<ContentFormat, string> = {
  post: "var(--vq-chart-post)",
  reel: "var(--vq-chart-reel)",
}

const FORMAT_NAME: Record<ContentFormat, { one: string; many: string }> = {
  post: { one: "post", many: "posts" },
  reel: { one: "reel", many: "reels" },
}

const KIND: Record<PlanSignalKind, { label: string; Icon: typeof Trophy }> = {
  own_post: { label: "Your account", Icon: Trophy },
  event: { label: "Calendar", Icon: CalendarDays },
  trend: { label: "Trend", Icon: TrendingUp },
  editorial: { label: "Editorial", Icon: Newspaper },
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// ─── Shared bits ─────────────────────────────────────────────────────────────

function Swatch({ format }: { format: ContentFormat }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2 shrink-0 rounded-[2px]"
      style={{ background: FORMAT_COLOR[format] }}
    />
  )
}

function StatTile({
  label,
  value,
  suffix,
  children,
}: {
  label: string
  value?: ReactNode
  suffix?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-[var(--vq-r)] border border-[var(--vq-line)] bg-card p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {value !== undefined && (
        <div className="flex items-baseline gap-1.5">
          <span className="font-head text-xl tabular-nums tracking-normal">{value}</span>
          {suffix && <span className="font-mono text-xs text-muted-foreground">{suffix}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

/** One bar split into post and reel, with the counts written out beside it. */
function MixBar({ posts, reels }: { posts: number; reels: number }) {
  const total = posts + reels
  return (
    <>
      <div className="flex items-baseline gap-1.5">
        <span className="font-head text-xl tabular-nums tracking-normal">{total}</span>
        <span className="font-mono text-xs text-muted-foreground">planned</span>
      </div>
      {/* 2px gap between segments so the two never bleed into each other. */}
      <div className="flex h-2 gap-0.5" role="img" aria-label={`${plural(posts, "post", "posts")}, ${plural(reels, "reel", "reels")}`}>
        {posts > 0 && (
          <div
            className="rounded-[4px]"
            style={{ flexGrow: posts, background: FORMAT_COLOR.post }}
            title={plural(posts, "post", "posts")}
          />
        )}
        {reels > 0 && (
          <div
            className="rounded-[4px]"
            style={{ flexGrow: reels, background: FORMAT_COLOR.reel }}
            title={plural(reels, "reel", "reels")}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Swatch format="post" />
          {plural(posts, "post", "posts")}
        </span>
        <span className="flex items-center gap-1">
          <Swatch format="reel" />
          {plural(reels, "reel", "reels")}
        </span>
      </div>
    </>
  )
}

// ─── Above the calendar ──────────────────────────────────────────────────────

export function PlanSummary({ plan, items }: { plan: ContentPlan; items: ContentPlanItem[] }) {
  const posts = items.filter((i) => i.format === "post").length
  const reels = items.filter((i) => i.format === "reel").length
  const backed = items.filter((i) => !i.isGapFiller).length
  const daysCovered = new Set(items.map((i) => i.date)).size

  const top = (plan.signals ?? [])
    .filter((s) => s.likes !== null)
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))[0]

  return (
    <div className="flex flex-col gap-3">
      {plan.headline && (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            This week&apos;s angle
          </span>
          <p className="font-head text-lg leading-snug tracking-normal">{plan.headline}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Format mix">
          <MixBar posts={posts} reels={reels} />
        </StatTile>

        <StatTile label="Backed by evidence" value={`${backed}/${items.length}`} suffix="slots">
          <div
            className="h-2 overflow-hidden rounded-[4px] bg-muted"
            role="img"
            aria-label={`${backed} of ${items.length} slots have a real signal behind them`}
          >
            <div
              className="h-full rounded-[4px] bg-foreground"
              style={{ width: `${items.length ? (backed / items.length) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {items.length - backed === 0
              ? "Every slot cites something Maya checked"
              : `${plural(items.length - backed, "slot is", "slots are")} a gap-filler`}
          </p>
        </StatTile>

        <StatTile label="Days covered" value={`${daysCovered}/7`} suffix="days">
          <p className="text-[11px] text-muted-foreground">
            {daysCovered === 7 ? "A post or reel every day" : `${7 - daysCovered} quiet ${7 - daysCovered === 1 ? "day" : "days"}`}
          </p>
        </StatTile>

        {top ? (
          <StatTile label="Best performer" value={top.likes} suffix="likes">
            <p className="line-clamp-2 text-[11px] text-muted-foreground" title={top.label}>
              {top.label}
              {top.comments !== null && ` · ${plural(top.comments, "comment", "comments")}`}
            </p>
          </StatTile>
        ) : (
          <StatTile label="Signals found" value={plan.signals?.length ?? 0} suffix="sources">
            <p className="text-[11px] text-muted-foreground">
              {plan.signals?.length ? "See what they show below" : "No structured evidence on this plan"}
            </p>
          </StatTile>
        )}
      </div>
    </div>
  )
}

// ─── Below the calendar ──────────────────────────────────────────────────────

/** Horizontal bars, one per past post Maya could put a number on. */
function EngagementChart({ rows }: { rows: PlanSignal[] }) {
  const sorted = [...rows].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
  const max = Math.max(1, ...sorted.map((r) => r.likes ?? 0))
  const formats = (["post", "reel"] as const).filter((f) => sorted.some((r) => r.format === f))

  return (
    <div className="flex flex-col gap-3 rounded-[var(--vq-r)] border border-[var(--vq-line)] bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">What&apos;s working</h4>
          <p className="text-[11px] text-muted-foreground">Likes on your recent posts that Maya could read</p>
        </div>
        {formats.length > 0 && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {formats.map((f) => (
              <span key={f} className="flex items-center gap-1">
                <Swatch format={f} />
                {FORMAT_NAME[f].one}
              </span>
            ))}
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-1.5">
        {sorted.map((r, i) => {
          const likes = r.likes ?? 0
          const detail = [
            plural(likes, "like", "likes"),
            r.comments !== null ? plural(r.comments, "comment", "comments") : null,
            r.source,
          ]
            .filter(Boolean)
            .join(" · ")
          return (
            <li
              key={`${r.label}-${i}`}
              title={`${r.label} — ${detail}`}
              className="group grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 rounded-sm py-0.5 hover:bg-muted/50 sm:grid-cols-[minmax(0,13rem)_1fr]"
            >
              <span className="truncate text-xs">{r.label}</span>
              <div className="flex min-w-0 items-center gap-2">
                <div
                  // Anchored to the baseline, rounded only where the data ends.
                  className="h-2.5 min-w-[3px] rounded-r-[4px]"
                  style={{
                    width: `${Math.max((likes / max) * 100, 1.5)}%`,
                    maxWidth: "calc(100% - 9.5rem)",
                    background: r.format ? FORMAT_COLOR[r.format] : "var(--muted-foreground)",
                  }}
                />
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground">{likes}</span> likes
                  {r.comments !== null && ` · ${plural(r.comments, "comment", "comments")}`}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SignalCard({ signal }: { signal: PlanSignal }) {
  const { label, Icon } = KIND[signal.kind]
  const hasMetric = signal.likes !== null || signal.comments !== null
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-[var(--vq-r)] border border-[var(--vq-line)] bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-sm font-medium leading-snug">{signal.label}</p>
      {signal.detail && <p className="text-xs leading-relaxed text-muted-foreground">{signal.detail}</p>}
      {(hasMetric || signal.source) && (
        <p className="mt-auto pt-1 text-[11px] text-muted-foreground">
          {[
            signal.likes !== null ? plural(signal.likes, "like", "likes") : null,
            signal.comments !== null ? plural(signal.comments, "comment", "comments") : null,
            signal.source,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </div>
  )
}

/** Bold the figures so the sentence still scans when it is all there is. */
const FIGURE = /(\d[\d,.]*\s?(?:likes?|comments?|reach|views?|saves?|shares?|%))/gi

function FallbackNote({ note }: { note: string }) {
  const sentences = note
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)
  return (
    <div className="flex flex-col gap-2 rounded-[var(--vq-r)] border border-[var(--vq-line)] bg-card p-4">
      <h4 className="text-sm font-semibold">What Maya found</h4>
      <ul className="flex flex-col gap-1.5">
        {sentences.map((s, i) => (
          <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/60" />
            <span>
              {s.split(FIGURE).map((part, j) =>
                j % 2 === 1 ? (
                  <strong key={j} className="font-semibold text-foreground">
                    {part}
                  </strong>
                ) : (
                  part
                ),
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PlanEvidence({ plan }: { plan: ContentPlan }) {
  const signals = plan.signals ?? []
  const measured = signals.filter((s) => s.likes !== null)
  // A single bar says nothing a sentence doesn't; charts start at two.
  const chartRows = measured.length >= 2 ? measured : []
  const cards = signals.filter((s) => !chartRows.includes(s))

  if (signals.length === 0) {
    return plan.note ? <FallbackNote note={plan.note} /> : null
  }

  return (
    <div className="flex flex-col gap-3">
      {chartRows.length > 0 && <EngagementChart rows={chartRows} />}

      {cards.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            What the plan is based on
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((s, i) => (
              <SignalCard key={`${s.label}-${i}`} signal={s} />
            ))}
          </div>
        </div>
      )}

      {plan.limits && plan.limits.length > 0 && (
        <div className="flex gap-2.5 rounded-[var(--vq-r)] border border-dashed border-[var(--vq-line-2)] bg-muted/30 p-3">
          <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">Limits of the data</span>
            <ul className="flex flex-col gap-0.5">
              {plan.limits.map((l, i) => (
                <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
