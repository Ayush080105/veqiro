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
  PenLine,
  Sparkles,
  Search,
} from "lucide-react"
import { AgentCard } from "@/components/ui/agent-card"
import { InfoSection } from "@/components/ui/info-section"
import { ActionRow } from "@/components/ui/action-row"
import { StatusPill } from "@/components/ui/status-pill"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  ScoutResearchTopicResult,
  ScoutResearchCompanyResult,
  ScoutTrendingTopicsResult,
  ScoutDiscoverCompetitorsResult,
  AgentActionId,
} from "@/lib/types/agents"

type FollowUp = (actionId: AgentActionId, prefill?: Record<string, unknown>) => void

const scoutSurfaceCls =
  "rounded-[var(--vq-r-sm)] border border-border/60 bg-background/65 p-3"
const scoutLabelCls = "text-xs font-semibold text-foreground"
const scoutBodyCls = "text-sm leading-relaxed text-foreground"

// ─── Research topic ──────────────────────────────────────────────────────────

function ResearchSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <p className={scoutLabelCls}>{label}</p>
      <div className={scoutBodyCls}>{children}</div>
    </section>
  )
}

function ScoutSurface({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(scoutSurfaceCls, className)}>
      {children}
    </div>
  )
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

type SourceEntry = string | { title: string; url: string }

function SourcesList({ sources }: { sources: SourceEntry[] }) {
  if (sources.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5 border-t border-border/50 pt-3">
      <p className={scoutLabelCls}>Sources</p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => {
          const url = typeof s === "string" ? s : s.url
          const label = typeof s === "string" ? hostnameOf(s) : s.title || hostnameOf(s.url)
          return (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={url}
              className="group inline-flex max-w-55 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span className="truncate">{label}</span>
              <ExternalLink className="size-2.5 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
            </a>
          )
        })}
      </div>
    </div>
  )
}

export function ResearchReportCard({
  result,
  onFollowUpAction,
}: {
  result: ScoutResearchTopicResult
  onFollowUpAction?: FollowUp
}) {
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Binoculars />}
        title="Research report"
      />
      <AgentCard.Body className="flex flex-col gap-4">

        {/* Bottom line */}
        {result.bottom_line && (
          <ScoutSurface className="space-y-1.5">
            <p className={scoutLabelCls}>Bottom line</p>
            <p className={scoutBodyCls}>{result.bottom_line}</p>
          </ScoutSurface>
        )}

        {/* Key stats grid */}
        {result.key_stats?.length > 0 && (
          <ResearchSection label="key stats">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {result.key_stats.map((s, i) => (
                <ScoutSurface key={i} className="space-y-1 p-2.5">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-sm font-semibold text-foreground">{s.value}</p>
                </ScoutSurface>
              ))}
            </div>
          </ResearchSection>
        )}

        {/* Market overview */}
        {result.market_overview && (
          <ResearchSection label="market overview">
            <p className="text-foreground">{result.market_overview}</p>
          </ResearchSection>
        )}

        {/* Target customers */}
        {result.target_customers && (
          <ResearchSection label="target customers">
            <p className="text-foreground">{result.target_customers}</p>
          </ResearchSection>
        )}

        {/* Key players */}
        {result.key_players?.length > 0 && (
          <ResearchSection label="key players">
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-[var(--vq-r-sm)] border border-border/60">
              {result.key_players.map((p, i) => (
                <div key={i} className="flex items-start gap-2 bg-background/65 px-3 py-2">
                  <div className="flex-1">
                    <span className="font-medium text-foreground">{p.name}</span>
                    {p.role && <span className="ml-1.5 text-xs text-muted-foreground">· {p.role}</span>}
                    {p.note && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.note}</p>}
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
                    <li key={i} className="flex gap-1.5 text-foreground">
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
                    <li key={i} className="flex gap-1.5 text-foreground">
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
                <StatusPill key={t} icon={null}>{t}</StatusPill>
              ))}
            </div>
          </ResearchSection>
        )}

        {/* Recommended actions */}
        {result.recommended_actions?.length > 0 && (
          <ResearchSection label="recommended actions">
            <ol className="flex flex-col gap-1.5">
              {result.recommended_actions.map((a, i) => (
                <li key={i} className="flex gap-2 text-foreground">
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
              <StatusPill key={k} icon={null}>{k}</StatusPill>
            ))}
          </div>
        )}

        {/* Sources */}
        {result.sources_scraped?.length > 0 && <SourcesList sources={result.sources_scraped} />}

        {onFollowUpAction && (
          <ActionRow className="border-t border-border/50 pt-3">
            <Button
              variant="chat-action"
              onClick={() => onFollowUpAction("maya:draft-content", {
                topic: result.bottom_line?.slice(0, 500) ?? result.market_overview?.slice(0, 200) ?? "",
                platform: "linkedin",
                additional_context: result.market_overview?.slice(0, 800) ?? "",
              })}
            >
              <PenLine data-icon="inline-start" /> Draft post · Maya
            </Button>
            <Button
              variant="chat-action"
              onClick={() => onFollowUpAction("sage:content-brief", {
                topic: result.bottom_line?.slice(0, 300) ?? "",
                target_keyword: result.keywords_found?.[0] ?? "",
              })}
            >
              <Sparkles data-icon="inline-start" /> Write blog brief · Sage
            </Button>
            <Button
              variant="chat-action"
              onClick={() => onFollowUpAction("sage:keyword-research", {
                seed_topic: result.market_overview?.slice(0, 200) ?? result.bottom_line?.slice(0, 200) ?? "",
              })}
            >
              <Search data-icon="inline-start" /> Find keywords · Sage
            </Button>
          </ActionRow>
        )}

      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Research company ────────────────────────────────────────────────────────

export function CompanyProfileCard({
  result,
  onFollowUpAction,
}: {
  result: ScoutResearchCompanyResult
  onFollowUpAction?: FollowUp
}) {
  const c = result.company
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<Building2 />} title={c.name} />
      <AgentCard.Body className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {c.description}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            <p className={scoutLabelCls}>Pricing</p>
            <div className="overflow-hidden rounded-[var(--vq-r-sm)] border border-border/60">
              {Object.entries(c.pricing).map(([tier, price]) => (
                <div
                  key={tier}
                  className="flex justify-between gap-3 border-b border-border/60 bg-background/65 px-3 py-2 text-sm last:border-0"
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
            <p className={scoutLabelCls}>Recent news</p>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm leading-relaxed">
              {c.recent_news.map((n, i) => (
                <li key={i} className={cn(scoutSurfaceCls, "p-2.5")}>
                  {n}
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.sources && c.sources.length > 0 && <SourcesList sources={c.sources} />}

        {onFollowUpAction && (
          <ActionRow className="border-t border-border/50 pt-3">
            <Button
              variant="chat-action"
              onClick={() => onFollowUpAction("maya:draft-content", {
                topic: `Why we're different from ${c.name}`,
                platform: "linkedin",
                additional_context: [c.description, c.weaknesses?.slice(0, 3).join("; ")].filter(Boolean).join("\n"),
              })}
            >
              <PenLine data-icon="inline-start" /> Draft post · Maya
            </Button>
          </ActionRow>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

function FactCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <ScoutSurface className="space-y-1 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm leading-relaxed text-foreground">{value}</p>
    </ScoutSurface>
  )
}

// ─── Discover competitors ─────────────────────────────────────────────────────

export function DiscoverCompetitorsCard({
  result,
  onFollowUpAction,
}: {
  result: ScoutDiscoverCompetitorsResult
  onFollowUpAction?: FollowUp
}) {
  return (
    <AgentCard size="sm">
      <AgentCard.Header icon={<Crosshair />} title={`${result.competitors.length} competitors found`} />
      <AgentCard.Body>
        <div className="flex flex-col gap-2">
          {result.competitors.map((c) => {
            return (
              <div
                key={c.url}
                className={cn(scoutSurfaceCls, "flex flex-col gap-2")}
              >
                <div className="flex items-center gap-1.5">
                  <p className="flex-1 text-sm font-semibold">{c.name}</p>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                  {onFollowUpAction && (
                    <Button
                      type="button"
                      variant="chat-utility"
                      onClick={() =>
                        onFollowUpAction("scout:research-company", {
                          company_name: c.name,
                          ...(c.url ? { company_url: c.url } : {}),
                        })
                      }
                    >
                      <Building2 className="size-3" /> Research
                    </Button>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {c.why_competitive}
                </p>
                <StatusPill icon={null}>Pricing: {c.pricing_model}</StatusPill>
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
    <section className="flex flex-col gap-1.5">
      <p className={scoutLabelCls}>{label}</p>
      <div className={scoutBodyCls}>{children}</div>
    </section>
  )
}

export function TrendsBoardCard({
  result,
  onFollowUpAction,
}: {
  result: ScoutTrendingTopicsResult
  onFollowUpAction?: FollowUp
}) {
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
            return (
              <div
                key={i}
                className={cn(scoutSurfaceCls, "flex flex-col gap-3")}
              >
                {/* Title + badges */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start gap-1.5">
                    <Icon className={cn("mt-0.5 size-3.5 shrink-0", momentumColor)} />
                    <p className="flex-1 text-sm font-semibold leading-snug">{t.topic}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusPill
                      level={t.momentum === "declining" ? "warn" : t.momentum === "rising" ? "ok" : "info"}
                      icon={<Icon />}
                    >
                      {t.momentum}
                    </StatusPill>
                    <StatusPill icon={null}>{Math.round(t.relevance_score * 100)}% relevant</StatusPill>
                    <StatusPill icon={null}>{t.search_volume_estimate}</StatusPill>
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
                          <StatusPill key={p} icon={null}>{p}</StatusPill>
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
                          <StatusPill key={r} icon={null}>{r}</StatusPill>
                        ))}
                      </div>
                    </TrendSection>
                  )}
                  {t.content_angle && (
                    <TrendSection label="Content angle">{t.content_angle}</TrendSection>
                  )}
                  {t.content_hook && (
                    <ScoutSurface className="space-y-1.5 border-dashed">
                      <p className={scoutLabelCls}>Hook idea</p>
                      <p className="text-sm italic leading-relaxed text-foreground">&ldquo;{t.content_hook}&rdquo;</p>
                    </ScoutSurface>
                  )}
                  {t.next_steps && t.next_steps.length > 0 && (
                    <TrendSection label="Next steps">
                      <ol className="mt-0.5 flex flex-col gap-1">
                        {t.next_steps.map((s, si) => (
                          <li key={si} className="flex gap-1.5">
                            <span className="shrink-0 text-xs font-semibold text-primary">{si + 1}.</span>
                            {s}
                          </li>
                        ))}
                      </ol>
                    </TrendSection>
                  )}

                  {onFollowUpAction && (
                    <ActionRow className="border-t border-border/50 pt-2">
                      <Button
                        variant="chat-action"
                        onClick={() => onFollowUpAction("maya:draft-content", {
                          topic: t.topic,
                          platform: "linkedin",
                          additional_context: [t.content_hook, t.why_trending, t.opportunity].filter(Boolean).join("\n"),
                        })}
                      >
                        <PenLine className="size-3" /> Draft post · Maya
                      </Button>
                      <Button
                        variant="chat-action"
                        onClick={() => onFollowUpAction("maya:generate-ideas", {
                          topic_hint: t.topic,
                        })}
                      >
                        <Sparkles className="size-3" /> Generate ideas · Maya
                      </Button>
                    </ActionRow>
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
