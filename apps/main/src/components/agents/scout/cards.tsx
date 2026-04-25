"use client"

import * as React from "react"
import {
  Binoculars,
  Building2,
  Radar,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AgentCard } from "@/components/ui/agent-card"
import { InfoSection } from "@/components/ui/info-section"
import { Kicker } from "@/components/ui/kicker"
import { MarkdownMessage } from "@/components/chat/MarkdownMessage"
import { cn } from "@/lib/utils"
import type {
  ScoutResearchTopicResult,
  ScoutResearchCompanyResult,
  ScoutCompetitorScanResult,
  ScoutTrendingTopicsResult,
} from "@/lib/types/agents"

// ─── Research topic ──────────────────────────────────────────────────────────

export function ResearchReportCard({ result }: { result: ScoutResearchTopicResult }) {
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Binoculars />}
        title="Research report"
        badge={
          <Badge variant="secondary" className="text-[10px]">
            {result.sources_scraped.length} sources
          </Badge>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Kicker prefix="//">synthesis</Kicker>
          <div className="text-[11px]">
            <MarkdownMessage content={result.synthesis} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Kicker prefix="//">findings</Kicker>
          <div className="max-h-72 overflow-y-auto border border-border bg-muted/20 p-2 text-[11px]">
            <MarkdownMessage content={result.findings} />
          </div>
        </div>
        {result.sources_scraped.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker prefix="//">sources</Kicker>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[11px]">
              {result.sources_scraped.map((s) => (
                <li key={s} className="truncate">
                  <a
                    href={s}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.keywords_found.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {result.keywords_found.map((k) => (
              <Badge key={k} variant="outline" className="text-[10px]">
                {k}
              </Badge>
            ))}
          </div>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Research company ────────────────────────────────────────────────────────

export function CompanyProfileCard({ result }: { result: ScoutResearchCompanyResult }) {
  const c = result.company
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<Building2 />} title={c.name} />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {c.description}
        </p>
        <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          {c.founded && (
            <FactCell label="Founded" value={c.founded} />
          )}
          {c.team_size && <FactCell label="Team" value={c.team_size} />}
          {c.funding && <FactCell label="Funding" value={c.funding} />}
          {c.target_market && <FactCell label="Market" value={c.target_market} />}
        </div>
        {c.key_features.length > 0 && (
          <InfoSection label="key features" bullets={c.key_features} />
        )}
        {c.pricing && Object.keys(c.pricing).length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker prefix="//">pricing</Kicker>
            <div className="border border-border">
              {Object.entries(c.pricing).map(([tier, price]) => (
                <div
                  key={tier}
                  className="flex justify-between border-b border-border px-2 py-1 text-[11px] last:border-0"
                >
                  <span>{tier}</span>
                  <span className="font-medium">{price}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <InfoSection label="strengths" bullets={c.strengths} />
          <InfoSection label="weaknesses" bullets={c.weaknesses} tone="danger" />
        </div>
        {c.recent_news.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker prefix="//">recent news</Kicker>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[11px]">
              {c.recent_news.map((n, i) => (
                <li key={i} className="border-l-2 border-border pl-2">
                  {n}
                </li>
              ))}
            </ul>
          </div>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

function FactCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p>{value}</p>
    </div>
  )
}

// ─── Competitor scan ─────────────────────────────────────────────────────────

export function CompetitorScanCard({ result }: { result: ScoutCompetitorScanResult }) {
  const sigCls = (s: string) =>
    s === "high"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : s === "medium"
        ? "bg-chart-3/15 text-chart-3 border-chart-3/30"
        : "bg-muted text-muted-foreground border-border"

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Radar />}
        title="Competitor scan"
        badge={
          <Badge variant="secondary" className="text-[10px]">
            {result.results.filter((r) => r.has_changes).length} changed
          </Badge>
        }
      />
      <AgentCard.Body>
        <div className="flex flex-col gap-1.5">
          {result.results.map((r) => (
            <div
              key={r.url}
              className="flex flex-col gap-1 border border-border bg-muted/20 p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{r.competitor_name}</p>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-[10px] text-muted-foreground hover:underline"
                  >
                    {r.url}
                  </a>
                </div>
                <span
                  className={cn(
                    "border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
                    sigCls(r.significance)
                  )}
                >
                  {r.significance}
                </span>
              </div>
              {r.has_changes ? (
                <p className="text-[11px] leading-relaxed">{r.change_summary}</p>
              ) : (
                <p className="text-[10px] italic text-muted-foreground">
                  No changes detected.
                </p>
              )}
            </div>
          ))}
        </div>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Trends board ────────────────────────────────────────────────────────────

export function TrendsBoardCard({ result }: { result: ScoutTrendingTopicsResult }) {
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<TrendingUp />} title="Trending topics" />
      <AgentCard.Body>
        <div className="grid gap-2 sm:grid-cols-2">
          {result.trends.map((t, i) => {
            const Icon =
              t.momentum === "rising"
                ? ArrowUpRight
                : t.momentum === "declining"
                  ? ArrowDownRight
                  : Minus
            const color =
              t.momentum === "rising"
                ? "text-chart-2"
                : t.momentum === "declining"
                  ? "text-destructive"
                  : "text-muted-foreground"
            return (
              <div
                key={i}
                className="flex flex-col gap-1 border border-border bg-muted/30 p-2"
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={cn("size-3", color)} />
                  <p className="flex-1 text-xs font-medium">{t.topic}</p>
                  <Badge variant="outline" className="text-[10px]">
                    rel {Math.round(t.relevance_score * 100)}%
                  </Badge>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {t.content_angle}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Search volume: {t.search_volume_estimate}
                </p>
              </div>
            )
          })}
        </div>
      </AgentCard.Body>
    </AgentCard>
  )
}
