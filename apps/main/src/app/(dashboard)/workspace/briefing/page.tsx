"use client"

import { useEffect, useRef, useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  MessageSquare,
  AlertCircle,
  RotateCcw,
} from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { getBriefing, type Briefing, type BriefingSection } from "@/lib/api/briefing"
import { getAgent } from "@/lib/config/agents"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBriefingDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function BriefingLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Overview skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-1 h-3 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-4/5" />
          <Skeleton className="mt-1.5 h-3 w-3/5" />
        </CardContent>
      </Card>
      {/* Section skeletons */}
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Error State ──────────────────────────────────────────────────────────────

function BriefingError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-destructive/20 bg-destructive/10">
      <CardContent className="flex flex-col items-start gap-4 py-8">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4" />
          <span className="text-sm font-medium">Could not load today&apos;s briefing</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Something went wrong while fetching your briefing. Your team is still working — try
          again in a moment.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="mr-1.5 size-3.5" />
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  section,
  index,
}: {
  section: BriefingSection
  index: number
}) {
  const [open, setOpen] = useState(true)
  const agent = getAgent(section.agent)

  return (
    <Card id={`section-${index}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar size="default">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                {agent?.initials ?? section.agent.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
              <CardDescription>
                {agent?.name ?? section.agent} &middot; {formatTimestamp(section.timestamp)}
              </CardDescription>
            </div>
          </div>
          <CollapsibleTrigger
            onClick={() => setOpen((v) => !v)}
            className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </CollapsibleTrigger>
        </div>
      </CardHeader>

      <Collapsible open={open}>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs/relaxed text-foreground leading-relaxed">{section.content}</p>

            {/* Action row */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button variant="outline" size="sm">
                <CheckCircle2 className="size-3.5" />
                Approve
              </Button>
              <Button variant="outline" size="sm">
                <X className="size-3.5" />
                Dismiss
              </Button>
              <Button variant="outline" size="sm">
                <MessageSquare className="size-3.5" />
                Follow up
              </Button>
              <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground">
                <RefreshCw className="size-3.5" />
                Regenerate
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// ─── Table of Contents ────────────────────────────────────────────────────────

function TableOfContents({
  sections,
  activeIdx,
}: {
  sections: BriefingSection[]
  activeIdx: number
}) {
  return (
    <nav className="flex flex-col gap-1">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        On this page
      </p>
      <a
        href="#overview"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
      >
        Overview
      </a>
      {sections.map((section, i) => (
        <a
          key={i}
          href={`#section-${i}`}
          className={[
            "text-xs py-0.5 transition-colors truncate",
            activeIdx === i
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {section.title}
        </a>
      ))}
    </nav>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BriefingPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])

  const today = new Date()

  async function loadBriefing() {
    setLoading(true)
    setError(false)
    try {
      const data = await getBriefing(organizationId)
      setBriefing(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBriefing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  // Highlight active TOC section on scroll
  useEffect(() => {
    if (!briefing) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id
            const match = id.match(/^section-(\d+)$/)
            if (match) setActiveIdx(parseInt(match[1]))
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    )
    const els = document.querySelectorAll("[id^='section-']")
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [briefing])

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Daily Briefing</h1>
        <p className="text-xs text-muted-foreground">{formatBriefingDate(today)}</p>
      </div>

      {loading ? (
        <BriefingLoadingSkeleton />
      ) : error ? (
        <BriefingError onRetry={loadBriefing} />
      ) : briefing ? (
        <div className="flex gap-8">
          {/* Main content */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {/* Executive Overview */}
            <Card id="overview">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Executive Overview</CardTitle>
                <CardDescription>Compiled by your AI team</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs/relaxed italic text-muted-foreground">{briefing.overview}</p>
              </CardContent>
            </Card>

            {/* Sections */}
            {briefing.sections.map((section, i) => (
              <SectionCard key={i} section={section} index={i} />
            ))}
          </div>

          {/* Sticky TOC sidebar — hidden on mobile */}
          <aside className="hidden w-48 shrink-0 xl:block">
            <div className="sticky top-6">
              <TableOfContents sections={briefing.sections} activeIdx={activeIdx} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
