"use client"

import React, { useEffect, useState } from "react"
import {
  RefreshCw,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Mail,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Calendar,
} from "lucide-react"

import { authClient } from "@/lib/auth-client"
import {
  getExistingBriefing,
  generateBriefing,
  type Briefing,
  type BriefingSection,
  type AgentSummary,
  type ScheduleItem,
} from "@/lib/api/briefing"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard"
import { getUpgradeRequiredReason } from "@/components/billing/upgrade-errors"

function formatBriefingDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function BriefingLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-8 w-12" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Empty / CTA state ────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Mail, label: "Email digest" },
  { icon: Calendar, label: "Today's schedule" },
  { icon: AlertTriangle, label: "Urgent actions" },
  { icon: Clock, label: "Free time blocks" },
]

function BriefingEmptyState({
  onGenerate,
  generating,
}: {
  onGenerate: () => void
  generating: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
        <Sparkles className="size-8 text-primary" />
      </div>

      <div className="flex flex-col gap-2 max-w-sm">
        <h2 className="text-lg font-semibold">No briefing yet for today</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Vega synthesises your emails, calendar, and financial data into a concise executive
          summary tailored to your day.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {FEATURES.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground"
          >
            <Icon className="size-3" />
            {label}
          </div>
        ))}
      </div>

      <Button onClick={onGenerate} disabled={generating} size="lg" className="mt-2 gap-2">
        {generating ? (
          <>
            <RefreshCw className="size-4 animate-spin" />
            Generating your briefing…
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            Generate Today&apos;s Briefing
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>

      {generating && (
        <p className="animate-pulse text-xs text-muted-foreground">
          Checking emails, calendar, and financial data…
        </p>
      )}
    </div>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────

function BriefingError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-destructive/20 bg-destructive/10">
      <CardContent className="flex flex-col items-start gap-4 py-8">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4" />
          <span className="text-sm font-medium">Could not load briefing</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Something went wrong. Make sure your Google account is connected and try again.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="mr-1.5 size-3.5" />
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
          <Icon className="size-3.5" />
          <span className="text-xs">{label}</span>
        </div>
        <span className="text-2xl font-bold leading-none">{value}</span>
        {sub && <span className="mt-0.5 text-xs text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ section }: { section: BriefingSection }) {
  const lines = section.content.split("\n").filter(Boolean)
  const isList = lines.length > 1 && lines.some((l) => /^\d+\./.test(l.trim()))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isList ? (
          <ol className="flex flex-col gap-2">
            {lines.map((line, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed">
                <span className="shrink-0 tabular-nums text-muted-foreground">{i + 1}.</span>
                <span>{line.replace(/^\d+\.\s*/, "")}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="whitespace-pre-line text-xs leading-relaxed">{section.content}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Today's schedule card ────────────────────────────────────────────────────

function TodayScheduleCard({ items }: { items: ScheduleItem[] }) {
  if (items.length === 0) return null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Today&apos;s Schedule</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-lg p-3"
            style={{ border: "1.5px solid #E5E5E5" }}
          >
            <div
              className="shrink-0 text-center"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                color: "#111",
                minWidth: 48,
                paddingTop: 1,
              }}
            >
              {item.time}
            </div>
            <div
              style={{ width: 2, borderRadius: 2, background: "var(--vq-green)", flexShrink: 0 }}
            />
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-xs font-semibold leading-snug">{item.event}</p>
              {item.location && (
                <p className="text-[10px] text-muted-foreground truncate" style={{ fontFamily: "var(--font-mono)" }}>
                  {item.location}
                </p>
              )}
              {item.prepNeeded && (
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Prep: {item.prepNeeded}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Email summary card ───────────────────────────────────────────────────────

const EMAIL_PRIORITIES = [
  { key: "urgent", label: "Urgent", bg: "#FEF2F2", color: "#CC3A21", border: "#FCA5A5" },
  { key: "high",   label: "High",   bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  { key: "medium", label: "Medium", bg: "#FEFCE8", color: "#A16207", border: "#FDE68A" },
  { key: "low",    label: "Low",    bg: "#F5F5F5", color: "#555555", border: "#E5E5E5" },
]

function EmailSummaryCard({ content }: { content: string }) {
  const counts: Record<string, number> = {}
  for (const line of content.split("\n")) {
    const [k, v] = line.split(":").map((s) => s.trim())
    if (k && v !== undefined) counts[k] = Number(v) || 0
  }
  const total = counts.total_unread ?? Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Email Summary</CardTitle>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "#F0F9FF", color: "#0369A1", border: "1px solid #BAE6FD", fontFamily: "var(--font-mono)" }}
          >
            {total} unread today
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2">
          {EMAIL_PRIORITIES.map(({ key, label, bg, color, border }) => (
            <div
              key={key}
              className="flex flex-col items-center gap-1 rounded-lg py-3"
              style={{ background: bg, border: `1.5px solid ${border}` }}
            >
              <span className="text-xl font-bold leading-none" style={{ color }}>
                {counts[key] ?? 0}
              </span>
              <span
                className="text-[9px] font-semibold uppercase tracking-wider"
                style={{ color, fontFamily: "var(--font-mono)" }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Label breakdown card ─────────────────────────────────────────────────────

function LabelBreakdownCard({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0)
  if (entries.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Email by Category</CardTitle>
        <CardDescription className="text-xs">Vega-labeled emails today</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {entries.map(([label, count]) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ border: "1.5px solid #E5E5E5", background: "#FAFAFA" }}
            >
              <span
                className="text-lg font-bold leading-none"
                style={{ color: "#111" }}
              >
                {count}
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Agent activity ───────────────────────────────────────────────────────────

const AGENT_META: Record<string, { name: string; color: string; role: string }> = {
  maya:  { name: "Maya",  color: "#F06464", role: "Content & Marketing" },
  rex:   { name: "Rex",   color: "#1DBC87", role: "Data & Finance" },
  scout: { name: "Scout", color: "#F5C518", role: "Research & Strategy" },
  sage:  { name: "Sage",  color: "#F79FD4", role: "SEO Specialist" },
  lex:   { name: "Lex",   color: "#8A8AF0", role: "Legal Assistant" },
  vega:  { name: "Vega",  color: "#6FCDE8", role: "Executive Assistant" },
}

function AgentActivitySection({ summaries }: { summaries: AgentSummary[] }) {
  if (summaries.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Agent Activity Today</h3>
        <p className="text-xs text-muted-foreground">What your AI team worked on</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 items-start">
        {summaries.map((s) => {
          const meta = AGENT_META[s.slug] ?? { name: s.slug, color: "#999", role: "" }
          return (
            <div
              key={s.slug}
              className="flex flex-col overflow-hidden rounded-xl"
              style={{ border: "2px solid #111", boxShadow: "3px 3px 0 #111" }}
            >
              {/* Coloured header bar */}
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ background: meta.color }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ background: "rgba(0,0,0,0.15)", color: "#fff", fontFamily: "var(--font-mono)" }}
                  >
                    {meta.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex flex-col leading-none">
                    <span className="text-xs font-bold text-[#111]">{meta.name}</span>
                    <span className="text-[9px] text-[#111] opacity-70" style={{ fontFamily: "var(--font-mono)" }}>{meta.role}</span>
                  </div>
                </div>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(0,0,0,0.15)", color: "#111", fontFamily: "var(--font-mono)" }}
                >
                  {s.messageCount} msg{s.messageCount !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Body */}
              <div className="flex flex-col gap-3 p-3" style={{ background: "#fff" }}>
                {s.summary && (
                  <p className="text-xs leading-relaxed text-muted-foreground">{s.summary}</p>
                )}

                {s.actionsTaken.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3 shrink-0" style={{ color: "#1DBC87" }} />
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)", color: "#1DBC87" }}>Actions</span>
                    </div>
                    {s.actionsTaken.map((a, i) => (
                      <div key={i} className="flex items-start gap-1.5 pl-4">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/40" />
                        <span className="text-[11px] text-foreground leading-relaxed">{a}</span>
                      </div>
                    ))}
                  </div>
                )}

                {s.keyOutputs.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="size-3 shrink-0" style={{ color: "#F5C518" }} />
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)", color: "#F5C518" }}>Outputs</span>
                    </div>
                    {s.keyOutputs.map((o, i) => (
                      <div key={i} className="flex items-start gap-1.5 pl-4">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/40" />
                        <span className="text-[11px] text-foreground leading-relaxed">{o}</span>
                      </div>
                    ))}
                  </div>
                )}

                {s.followUps.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3 shrink-0 text-muted-foreground" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>Follow-ups</span>
                    </div>
                    {s.followUps.map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5 pl-4">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/30" />
                        <span className="text-[11px] text-muted-foreground leading-relaxed">{f}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Briefing display ─────────────────────────────────────────────────────────

function BriefingDisplay({
  briefing,
  onRegenerate,
  regenerating,
}: {
  briefing: Briefing
  onRegenerate: () => void
  regenerating: boolean
}) {
  const { stats } = briefing

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={AlertTriangle} label="Urgent actions" value={stats.urgentActionsCount} />
        <StatCard
          icon={Mail}
          label="Unread emails"
          value={stats.totalUnread}
          sub={stats.urgentEmails > 0 ? `${stats.urgentEmails} urgent` : undefined}
        />
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Executive Overview</CardTitle>
          {stats.priorityScore && (
            <CardDescription>Priority level: {stats.priorityScore}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs/relaxed italic text-muted-foreground">{briefing.overview}</p>
          {stats.focusRecommendation && (
            <p className="border-t border-border/50 pt-3 text-xs text-foreground">
              💡 {stats.focusRecommendation}
            </p>
          )}
        </CardContent>
      </Card>

      {briefing.sections.map((section, i) =>
        section.title === "Email Summary" ? (
          <>
            <EmailSummaryCard key={i} content={section.content} />
            <LabelBreakdownCard counts={briefing.labelCounts} />
          </>
        ) : section.title === "Today's Schedule" ? (
          <TodayScheduleCard key={i} items={briefing.scheduleItems} />
        ) : (
          <SectionCard key={i} section={section} />
        )
      )}

      <AgentActivitySection summaries={briefing.agentSummaries} />

      <div className="flex justify-end pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRegenerate}
          disabled={regenerating}
          className="text-muted-foreground"
        >
          <RefreshCw
            className={["size-3.5 mr-1.5", regenerating ? "animate-spin" : ""].join(" ").trim()}
          />
          Regenerate briefing
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BriefingPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()

  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [phase, setPhase] = useState<"loading" | "empty" | "ready" | "error">("loading")
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const today = new Date()

  async function load() {
    setPhase("loading")
    setUpgradeReason(null)
    try {
      const data = await getExistingBriefing()
      if (data) {
        setBriefing(data)
        setPhase("ready")
      } else {
        setPhase("empty")
      }
    } catch (err) {
      const reason = getUpgradeRequiredReason(err)
      if (reason) {
        setUpgradeReason(reason)
      } else {
        setPhase("error")
      }
    }
  }

  async function generate() {
    setGenerating(true)
    setUpgradeReason(null)
    try {
      const data = await generateBriefing()
      setBriefing(data)
      setPhase("ready")
    } catch (err) {
      const reason = getUpgradeRequiredReason(err)
      if (reason) {
        setUpgradeReason(reason)
      } else {
        setPhase("error")
      }
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    if (activeOrg?.id) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrg?.id])

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker={formatBriefingDate(today)}
        title="daily briefing"
        subtitle="Your AI team's executive summary — emails, calendar, and priorities in one view."
        sticker={{ label: "today's brief", rot: -5, color: "var(--vq-green)" }}
      />

      {upgradeReason && <UpgradeRequiredCard reason={upgradeReason} />}
      {!upgradeReason && phase === "loading" && <BriefingLoadingSkeleton />}
      {!upgradeReason && phase === "empty" && (
        <BriefingEmptyState onGenerate={generate} generating={generating} />
      )}
      {!upgradeReason && phase === "error" && <BriefingError onRetry={load} />}
      {!upgradeReason && phase === "ready" && briefing && (
        <BriefingDisplay briefing={briefing} onRegenerate={generate} regenerating={generating} />
      )}
    </div>
  )
}
