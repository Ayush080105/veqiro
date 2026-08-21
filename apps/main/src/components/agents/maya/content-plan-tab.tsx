"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CalendarDays, Film, HelpCircle, Image as ImageIcon, Sparkles, Wand2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { qk } from "@/lib/query-keys"
import {
  useContentPlans,
  generateContentPlan,
  type ContentPlan,
  type ContentPlanItem,
} from "@/lib/api/assistants"

/**
 * The weekly content plan, as a calendar.
 *
 * A week has a shape — how many posts, how they alternate, where the quiet days
 * are — and a vertical list of cards hides all of it. Laid out as seven columns
 * the rhythm is legible at a glance, and an empty day reads as an empty day
 * rather than as an absence you have to notice.
 *
 * The reasoning behind each slot is the most valuable part of the plan and the
 * part that cannot fit in a calendar cell, so cells carry the hook and a
 * selected day opens the full argument underneath. Shape first, detail on
 * demand.
 */

const FORMAT = {
  post: { label: "Static post", short: "POST", Icon: ImageIcon, color: "var(--vq-blue)" },
  reel: { label: "Reel", short: "REEL", Icon: Film, color: "var(--vq-violet)" },
} as const

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

/** Monday-first index, so the week reads the way the plan is written. */
const dayIndex = (iso: string): number => {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return -1
  return (d.getUTCDay() + 6) % 7
}

function DayCell({
  label,
  date,
  items,
  selectedId,
  onSelect,
}: {
  label: string
  date: Date | null
  items: ContentPlanItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex min-h-[132px] min-w-0 flex-col gap-1.5 border-r border-b border-[#D4C9B0] p-2 last:border-r-0">
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">{label}</span>
        {date && <span className="text-[10px] text-muted-foreground/60">{date.getUTCDate()}</span>}
      </div>

      {items.length === 0 ? (
        // Left genuinely blank. A quiet day is information — filling it with
        // "nothing planned" would make every rest day look like a mistake.
        <div className="flex-1" />
      ) : (
        items.map((item, i) => {
          const meta = FORMAT[item.format] ?? FORMAT.post
          const id = `${item.date}-${i}`
          const selected = selectedId === id
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`flex flex-col gap-1 rounded-md border p-1.5 text-left transition-colors ${
                selected
                  ? "border-foreground bg-[#EFE7D6]"
                  : "border-[#D4C9B0] bg-[#FFF9ED] hover:bg-[#F6F0E2]"
              } ${item.isGapFiller ? "border-dashed" : ""}`}
            >
              <span className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: meta.color }}
                />
                <span className="font-mono text-[9px] tracking-wider text-muted-foreground">
                  {meta.short}
                </span>
                {item.isGapFiller && (
                  <HelpCircle className="size-2.5 shrink-0 text-muted-foreground/60" />
                )}
              </span>
              <span className="line-clamp-3 text-[11px] font-medium leading-snug">{item.hook}</span>
            </button>
          )
        })
      )}
    </div>
  )
}

/** The full argument for one slot — the part that can't live in a cell. */
function ItemDetail({
  item,
  onCreate,
}: {
  item: ContentPlanItem
  onCreate?: (item: ContentPlanItem) => void
}) {
  const meta = FORMAT[item.format] ?? FORMAT.post
  const { Icon } = meta

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">{item.day || item.date}</span>
        <span
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
          style={{ background: meta.color, color: "#111" }}
        >
          <Icon className="size-3" />
          {meta.label}
        </span>
        {item.isGapFiller && (
          <span className="flex items-center gap-1 rounded-full bg-[#EFE7D6] px-2 py-0.5 text-[10px] text-muted-foreground">
            <HelpCircle className="size-3" />
            No strong signal
          </span>
        )}
      </div>

      {item.hook && <p className="text-sm font-medium leading-snug">{item.hook}</p>}

      {item.captionDirection && (
        <p className="text-xs leading-relaxed text-muted-foreground">{item.captionDirection}</p>
      )}

      {(item.reason || item.formatReason) && (
        <div className="flex flex-col gap-1 border-t border-[#EFE7D6] pt-2">
          {item.reason && (
            <p className="text-[11px] leading-relaxed">
              <span className="font-medium">Why: </span>
              <span className="text-muted-foreground">{item.reason}</span>
            </p>
          )}
          {item.formatReason && (
            <p className="text-[11px] leading-relaxed">
              <span className="font-medium">Why {meta.label.toLowerCase()}: </span>
              <span className="text-muted-foreground">{item.formatReason}</span>
            </p>
          )}
        </div>
      )}

      {/* The plan is only worth having if acting on it is one click. Opens the
          existing generator with this slot's angle already filled in, rather
          than making the owner retype what Maya just proposed. */}
      {onCreate && (
        <button
          onClick={() => onCreate(item)}
          className="flex w-fit items-center gap-1.5 rounded-full bg-[#111] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          <Wand2 className="size-3" />
          {item.format === "reel" ? "Make this reel" : "Make this post"}
        </button>
      )}
    </div>
  )
}

function PlanView({
  plan,
  onCreate,
}: {
  plan: ContentPlan
  onCreate?: (item: ContentPlanItem) => void
}) {
  const weekStart = new Date(plan.weekStart)
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)

  // Memoised so the bucketing below does not re-run on every render: the ?? []
  // fallback allocates a fresh array each time otherwise.
  const items = useMemo(() => plan.items ?? [], [plan.items])

  // Bucket by weekday so the grid can be rendered positionally. Anything with
  // an unparseable date lands on Monday rather than disappearing.
  const byDay = useMemo(() => {
    const buckets: ContentPlanItem[][] = [[], [], [], [], [], [], []]
    for (const item of items) {
      const idx = dayIndex(item.date)
      buckets[idx === -1 ? 0 : idx]!.push(item)
    }
    return buckets
  }, [items])

  const firstId = useMemo(() => {
    for (let d = 0; d < 7; d += 1) {
      const first = byDay[d]?.[0]
      if (first) return `${first.date}-0`
    }
    return null
  }, [byDay])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeId = selectedId ?? firstId

  const selectedItem = useMemo(() => {
    for (const bucket of byDay) {
      for (let i = 0; i < bucket.length; i += 1) {
        if (`${bucket[i]!.date}-${i}` === activeId) return bucket[i]!
      }
    }
    return null
  }, [byDay, activeId])

  if (items.length === 0) {
    // Parsing failed. The prose is still perfectly readable — showing it beats
    // showing an error for a plan that was generated fine.
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">
          {fmt(weekStart)} – {fmt(weekEnd)}
        </h3>
        {plan.note && <p className="text-xs text-muted-foreground">{plan.note}</p>}
        <pre className="whitespace-pre-wrap rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] p-3 font-sans text-xs leading-relaxed">
          {plan.rawText}
        </pre>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-[#D4C9B0]">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#111] px-3 py-2">
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-[#FFF9ED]">
            {fmt(weekStart)} – {fmt(weekEnd)}
          </h3>
          <div className="flex items-center gap-3">
            {(["post", "reel"] as const).map((key) => (
              <span key={key} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ background: FORMAT[key].color }}
                />
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#FFF9ED]/70">
                  {FORMAT[key].short}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Seven columns need real width. In a narrow chat panel they collapse
            to ~85px and clip mid-word, so the grid keeps a minimum width and
            scrolls sideways instead of shrinking past legibility. */}
        <div className="overflow-x-auto">
        <div className="grid grid-cols-1 sm:grid-cols-7 sm:min-w-[720px]">
          {DAY_LABELS.map((label, i) => {
            const date = new Date(weekStart)
            date.setUTCDate(date.getUTCDate() + i)
            return (
              <DayCell
                key={label}
                label={label}
                date={date}
                items={byDay[i] ?? []}
                selectedId={activeId}
                onSelect={setSelectedId}
              />
            )
          })}
        </div>
        </div>
      </div>

      {/* The note carries the caveats — how thin the data was, what wasn't
          available. Kept close to the grid rather than buried at the bottom. */}
      {plan.note && (
        <p className="rounded-lg border border-[#D4C9B0] bg-[#F6F0E2] p-3 text-xs leading-relaxed text-muted-foreground">
          {plan.note}
        </p>
      )}

      {selectedItem && <ItemDetail item={selectedItem} onCreate={onCreate} />}
    </div>
  )
}

export function MayaContentPlanTab({
  onCreate,
}: {
  /** Opens the matching generator with this slot prefilled. */
  onCreate?: (item: ContentPlanItem) => void
} = {}) {
  // useActiveOrganization, not useSession — the session object carries no
  // activeOrganization, so reading it there yields "" and leaves the query
  // disabled, which react-query reports as `pending` forever rather than as an
  // error. That renders as a tab stuck on "Loading…" with nothing in the
  // console.
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const { data: plans = [], isPending, isError, error } = useContentPlans(organizationId)
  const queryClient = useQueryClient()
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async () => {
    if (!organizationId) {
      toast.error("No active organization selected")
      return
    }
    setGenerating(true)
    try {
      await generateContentPlan(organizationId)
      await queryClient.invalidateQueries({ queryKey: qk.mayaContentPlans(organizationId) })
      toast.success("Plan ready")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't build a plan")
    } finally {
      setGenerating(false)
    }
  }

  const [latest, ...older] = plans

  return (
    <div className="flex h-full min-w-0 flex-col overflow-y-auto p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm font-semibold">Content plan</h2>
          <p className="text-xs text-muted-foreground">
            Next week&apos;s posts and reels, each with the reason it&apos;s there.
            Nothing is created or published here.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !organizationId}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#111] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles className="size-3" />
          {generating ? "Planning…" : "Generate plan"}
        </button>
      </div>

      {!organizationId ? (
        <p className="text-xs text-muted-foreground">No workspace selected.</p>
      ) : isError ? (
        <p className="text-xs text-destructive">
          Couldn&apos;t load plans: {error instanceof Error ? error.message : "Unknown error"}
        </p>
      ) : isPending ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-[#D4C9B0] p-4">
          <CalendarDays className="size-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            No plan yet. Generate one, or switch on the weekly play under Tasks →
            Recurring and it&apos;ll arrive every Friday.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {latest && <PlanView plan={latest} onCreate={onCreate} />}

          {older.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Earlier plans
              </h3>
              {older.map((plan) => (
                <details key={plan.id} className="rounded-lg border border-[#D4C9B0] p-3">
                  <summary className="cursor-pointer text-xs font-medium">
                    Week of{" "}
                    {new Date(plan.weekStart).toLocaleDateString(undefined, { timeZone: "UTC" })}
                  </summary>
                  <div className="pt-3">
                    <PlanView plan={plan} onCreate={onCreate} />
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
