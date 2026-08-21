"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CalendarDays, Film, HelpCircle, Image as ImageIcon, Sparkles } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { qk } from "@/lib/query-keys"
import {
  useContentPlans,
  generateContentPlan,
  type ContentPlan,
  type ContentPlanItem,
} from "@/lib/api/assistants"

/**
 * The weekly content plan, as an artifact rather than a chat message.
 *
 * Each item leads with the day and format, then the angle, then the reason it
 * exists. The reason is deliberately given as much room as the idea: a plan you
 * can argue with is worth more than a list of suggestions, and the reasoning is
 * the part that makes it arguable.
 *
 * Gap-fillers — slots Maya found no real signal for and said so — are marked
 * rather than hidden. That honesty is the feature: it tells the owner exactly
 * where their own judgement is needed.
 */

const formatMeta = {
  post: { label: "Static post", Icon: ImageIcon },
  reel: { label: "Reel", Icon: Film },
} as const

function PlanItem({ item }: { item: ContentPlanItem }) {
  const { label, Icon } = formatMeta[item.format] ?? formatMeta.post

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">{item.day || item.date}</span>
        <span className="flex items-center gap-1 rounded-full border border-[#D4C9B0] px-2 py-0.5 text-[10px]">
          <Icon className="size-3" />
          {label}
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
              <span className="font-medium">Why {label.toLowerCase()}: </span>
              <span className="text-muted-foreground">{item.formatReason}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function PlanView({ plan }: { plan: ContentPlan }) {
  const weekStart = new Date(plan.weekStart)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold">
          {fmt(weekStart)} – {fmt(weekEnd)}
        </h3>
        <span className="text-[11px] text-muted-foreground">
          planned {new Date(plan.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* The note usually carries the caveats — how thin the data was, what
          wasn't available. That belongs above the plan, not buried under it. */}
      {plan.note && (
        <p className="rounded-lg border border-[#D4C9B0] bg-[#F6F0E2] p-3 text-xs leading-relaxed text-muted-foreground">
          {plan.note}
        </p>
      )}

      {plan.items && plan.items.length > 0 ? (
        <div className="flex flex-col gap-2">
          {plan.items.map((item, i) => (
            <PlanItem key={`${item.date}-${i}`} item={item} />
          ))}
        </div>
      ) : (
        // Parsing failed. Showing the prose beats showing an error — the plan
        // is still perfectly readable, just not as cards.
        <pre className="whitespace-pre-wrap rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] p-3 font-sans text-xs leading-relaxed">
          {plan.rawText}
        </pre>
      )}
    </div>
  )
}

export function MayaContentPlanTab() {
  const { data: session } = authClient.useSession()
  const activeOrg = (session as { activeOrganization?: { id?: string } } | null)?.activeOrganization
  const organizationId = activeOrg?.id ?? ""

  const { data: plans = [], isPending } = useContentPlans(organizationId)
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
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
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

      {isPending ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-[#D4C9B0] p-4">
          <CalendarDays className="size-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            No plan yet. Generate one, or switch on the weekly play in Settings →
            Integrations and it&apos;ll arrive every Friday.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {latest && <PlanView plan={latest} />}

          {older.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Earlier plans
              </h3>
              {older.map((plan) => (
                <details key={plan.id} className="rounded-lg border border-[#D4C9B0] p-3">
                  <summary className="cursor-pointer text-xs font-medium">
                    Week of {new Date(plan.weekStart).toLocaleDateString()}
                  </summary>
                  <div className="pt-3">
                    <PlanView plan={plan} />
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
