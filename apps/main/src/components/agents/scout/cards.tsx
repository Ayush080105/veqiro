"use client"

import * as React from "react"
import {
  Binoculars,
  Building2,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Crosshair,
  ExternalLink,
  BookmarkPlus,
  Check,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AgentCard } from "@/components/ui/agent-card"
import { InfoSection } from "@/components/ui/info-section"
import { Kicker } from "@/components/ui/kicker"
import { MarkdownMessage } from "@/components/chat/MarkdownMessage"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAddCompetitorWatch } from "@/lib/api/scout"
import type {
  ScoutResearchTopicResult,
  ScoutResearchCompanyResult,
  ScoutTrendingTopicsResult,
  ScoutDiscoverCompetitorsResult,
} from "@/lib/types/agents"

// ─── Research topic ──────────────────────────────────────────────────────────

function ResearchSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Kicker prefix="//">{label}</Kicker>
      <div className="text-[11px] leading-relaxed">{children}</div>
    </div>
  )
}

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
      <AgentCard.Body className="flex flex-col gap-4">

        {/* Bottom line */}
        {result.bottom_line && (
          <div className="border-l-2 border-primary pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Bottom line</p>
            <p className="text-[11px] leading-relaxed text-foreground">{result.bottom_line}</p>
          </div>
        )}

        {/* Key stats grid */}
        {result.key_stats?.length > 0 && (
          <ResearchSection label="key stats">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {result.key_stats.map((s, i) => (
                <div key={i} className="flex flex-col gap-0.5 border border-border bg-muted/30 p-2">
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  <p className="text-xs font-semibold text-foreground">{s.value}</p>
                </div>
              ))}
            </div>
          </ResearchSection>
        )}

        {/* Market overview */}
        {result.market_overview && (
          <ResearchSection label="market overview">
            <p className="text-muted-foreground">{result.market_overview}</p>
          </ResearchSection>
        )}

        {/* Target customers */}
        {result.target_customers && (
          <ResearchSection label="target customers">
            <p className="text-muted-foreground">{result.target_customers}</p>
          </ResearchSection>
        )}

        {/* Key players */}
        {result.key_players?.length > 0 && (
          <ResearchSection label="key players">
            <div className="flex flex-col divide-y divide-border border border-border">
              {result.key_players.map((p, i) => (
                <div key={i} className="flex items-start gap-2 px-2 py-1.5">
                  <div className="flex-1">
                    <span className="font-medium text-foreground">{p.name}</span>
                    {p.role && <span className="ml-1.5 text-[10px] text-muted-foreground">· {p.role}</span>}
                    {p.note && <p className="mt-0.5 text-[10px] text-muted-foreground">{p.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </ResearchSection>
        )}

        {/* Opportunities + Risks side by side */}
        {(result.opportunities?.length > 0 || result.risks?.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {result.opportunities?.length > 0 && (
              <ResearchSection label="opportunities">
                <ul className="flex flex-col gap-1.5">
                  {result.opportunities.map((o, i) => (
                    <li key={i} className="flex gap-1.5 text-muted-foreground">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-chart-2" />
                      {o}
                    </li>
                  ))}
                </ul>
              </ResearchSection>
            )}
            {result.risks?.length > 0 && (
              <ResearchSection label="risks & challenges">
                <ul className="flex flex-col gap-1.5">
                  {result.risks.map((r, i) => (
                    <li key={i} className="flex gap-1.5 text-muted-foreground">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-destructive/70" />
                      {r}
                    </li>
                  ))}
                </ul>
              </ResearchSection>
            )}
          </div>
        )}

        {/* Emerging trends */}
        {result.emerging_trends?.length > 0 && (
          <ResearchSection label="emerging trends">
            <div className="flex flex-wrap gap-1.5">
              {result.emerging_trends.map((t) => (
                <span key={t} className="rounded border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          </ResearchSection>
        )}

        {/* Recommended actions */}
        {result.recommended_actions?.length > 0 && (
          <ResearchSection label="recommended actions">
            <ol className="flex flex-col gap-1.5">
              {result.recommended_actions.map((a, i) => (
                <li key={i} className="flex gap-2 text-muted-foreground">
                  <span className="shrink-0 font-bold text-primary">{i + 1}.</span>
                  {a}
                </li>
              ))}
            </ol>
          </ResearchSection>
        )}

        {/* Keywords */}
        {result.keywords_found?.length > 0 && (
          <div className="flex flex-wrap gap-1 border-t border-border/50 pt-3">
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

// ─── Discover competitors ─────────────────────────────────────────────────────

export function DiscoverCompetitorsCard({ result }: { result: ScoutDiscoverCompetitorsResult }) {
  const addCompetitor = useAddCompetitorWatch()
  const [saved, setSaved] = React.useState<Set<string>>(new Set())

  const handleSave = async (name: string, url: string) => {
    await addCompetitor.mutateAsync({ name, url })
    setSaved((prev) => new Set([...prev, url]))
  }

  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<Crosshair />} title={`${result.competitors.length} competitors found`} />
      <AgentCard.Body>
        <div className="flex flex-col gap-2">
          {result.competitors.map((c) => {
            const isSaved = saved.has(c.url)
            return (
              <div
                key={c.url}
                className="flex flex-col gap-1 border border-border bg-muted/30 p-2"
              >
                <div className="flex items-center gap-1.5">
                  <p className="flex-1 text-xs font-medium">{c.name}</p>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                  <Button
                    type="button"
                    variant={isSaved ? "default" : "outline"}
                    size="sm"
                    className="h-6 gap-1 px-2 text-[10px]"
                    disabled={isSaved || addCompetitor.isPending}
                    onClick={() => handleSave(c.name, c.url)}
                  >
                    {isSaved ? (
                      <><Check className="size-3" /> Saved</>
                    ) : (
                      <><BookmarkPlus className="size-3" /> Save</>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {c.why_competitive}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Pricing: {c.pricing_model}
                </p>
              </div>
            )
          })}
        </div>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Trends board ────────────────────────────────────────────────────────────

function TrendSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-[11px] leading-relaxed text-foreground">{children}</div>
    </div>
  )
}

export function TrendsBoardCard({ result }: { result: ScoutTrendingTopicsResult }) {
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<TrendingUp />} title="Trending topics" />
      <AgentCard.Body>
        <div className="flex flex-col gap-3">
          {result.trends.map((t, i) => {
            const Icon =
              t.momentum === "rising"
                ? ArrowUpRight
                : t.momentum === "declining"
                  ? ArrowDownRight
                  : Minus
            const momentumColor =
              t.momentum === "rising"
                ? "text-chart-2"
                : t.momentum === "declining"
                  ? "text-destructive"
                  : "text-muted-foreground"
            const momentumBg =
              t.momentum === "rising"
                ? "bg-chart-2/10 text-chart-2"
                : t.momentum === "declining"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
            return (
              <div
                key={i}
                className="flex flex-col gap-3 border border-border bg-muted/20 p-3"
              >
                {/* Title + badges */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start gap-1.5">
                    <Icon className={cn("mt-0.5 size-3.5 shrink-0", momentumColor)} />
                    <p className="flex-1 text-xs font-semibold leading-snug">{t.topic}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize", momentumBg)}>
                      <Icon className="size-2.5" />{t.momentum}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {Math.round(t.relevance_score * 100)}% relevant
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {t.search_volume_estimate}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-border/50 pt-3">
                  {t.why_trending && (
                    <TrendSection label="Why now">{t.why_trending}</TrendSection>
                  )}
                  {t.market_size && (
                    <TrendSection label="Market size">{t.market_size}</TrendSection>
                  )}
                  {t.target_audience && (
                    <TrendSection label="Target audience">{t.target_audience}</TrendSection>
                  )}
                  {t.key_players && t.key_players.length > 0 && (
                    <TrendSection label="Key players">
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {t.key_players.map((p) => (
                          <span key={p} className="rounded bg-muted border border-border px-1.5 py-0.5 text-[10px]">
                            {p}
                          </span>
                        ))}
                      </div>
                    </TrendSection>
                  )}
                  {t.opportunity && (
                    <TrendSection label="Business opportunity">{t.opportunity}</TrendSection>
                  )}
                  {t.key_challenges && t.key_challenges.length > 0 && (
                    <TrendSection label="Key challenges">
                      <ul className="mt-0.5 flex flex-col gap-1">
                        {t.key_challenges.map((c, ci) => (
                          <li key={ci} className="flex gap-1.5">
                            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-destructive/60" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </TrendSection>
                  )}
                  {t.time_horizon && (
                    <TrendSection label="Time horizon">{t.time_horizon}</TrendSection>
                  )}
                  {t.related_trends && t.related_trends.length > 0 && (
                    <TrendSection label="Related trends">
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {t.related_trends.map((r) => (
                          <span key={r} className="rounded bg-muted border border-border px-1.5 py-0.5 text-[10px]">
                            {r}
                          </span>
                        ))}
                      </div>
                    </TrendSection>
                  )}
                  {t.content_angle && (
                    <TrendSection label="Content angle">{t.content_angle}</TrendSection>
                  )}
                  {t.content_hook && (
                    <div className="rounded border border-dashed border-border bg-background px-2.5 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Hook idea</p>
                      <p className="text-[11px] italic text-foreground">&ldquo;{t.content_hook}&rdquo;</p>
                    </div>
                  )}
                  {t.next_steps && t.next_steps.length > 0 && (
                    <TrendSection label="Next steps">
                      <ol className="mt-0.5 flex flex-col gap-1">
                        {t.next_steps.map((s, si) => (
                          <li key={si} className="flex gap-1.5">
                            <span className="shrink-0 text-[10px] font-bold text-primary">{si + 1}.</span>
                            {s}
                          </li>
                        ))}
                      </ol>
                    </TrendSection>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </AgentCard.Body>
    </AgentCard>
  )
}
