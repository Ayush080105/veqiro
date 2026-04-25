"use client"

import * as React from "react"
import { toast } from "sonner"
import { Copy, Download, FileText, Search, Gauge, ClipboardList } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AgentCard } from "@/components/ui/agent-card"
import { CollapsibleSection } from "@/components/ui/collapsible-section"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { CopyButton } from "@/components/ui/copy-button"
import { InfoSection } from "@/components/ui/info-section"
import { Kicker } from "@/components/ui/kicker"
import { MarkdownMessage } from "@/components/chat/MarkdownMessage"
import { cn } from "@/lib/utils"
import type {
  SageKeywordResearchResult,
  SageGenerateBlogResult,
  SageContentAnalysisResult,
  SageContentBriefResult,
} from "@/lib/types/agents"

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80 ? "text-chart-2" : score >= 60 ? "text-chart-3" : "text-destructive"
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("font-display text-lg leading-none", color)}>{score}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

function copyText(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(label))
}

// ─── Keyword Cluster Card ────────────────────────────────────────────────────

export function KeywordClusterCard({ result }: { result: SageKeywordResearchResult }) {
  const clusters = result.clusters ?? []
  const flatList = result.keywords ?? []

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Search />}
        title="Keyword research"
        badge={
          <Badge variant="secondary" className="text-[10px]">
            {flatList.length} keywords · {clusters.length} clusters
          </Badge>
        }
      />
      <AgentCard.Body>
        <div className="flex flex-col gap-2">
          {clusters.map((c) => (
            <CollapsibleSection
              key={c.cluster_name}
              title={c.cluster_name}
              subtitle={`${c.keywords.length} keywords · ${c.primary_intent}`}
              badge={
                <Badge variant="outline" className="text-[10px]">
                  {c.primary_intent}
                </Badge>
              }
            >
              <div className="flex flex-col gap-1">
                {c.keywords.map((k) => (
                  <div
                    key={k.keyword}
                    className="flex items-center gap-2 border border-border bg-background px-2 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs">{k.keyword}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {k.search_intent} · {k.suggested_content_type}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        diff {k.estimated_difficulty}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        rel {Math.round(k.relevance_score * 100)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          ))}
        </div>
      </AgentCard.Body>
      <AgentCard.Footer>
        <CopyButton
          text={flatList.map((k) => k.keyword).join("\n")}
          label="Copy all keywords"
          successLabel="Keywords copied"
        />
      </AgentCard.Footer>
    </AgentCard>
  )
}

// ─── Blog preview card ───────────────────────────────────────────────────────

export function BlogPreviewCard({ result }: { result: SageGenerateBlogResult }) {
  const { blog, seo_score, seo_suggestions } = result
  const downloadMd = () => {
    const blob = new Blob([blog.content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${blog.slug ?? "blog"}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<FileText />}
        title={blog.title}
        right={<ScoreGauge score={seo_score} label="SEO" />}
      />
      <AgentCard.Body className="flex flex-col gap-3">
        {blog.meta_description && (
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {blog.meta_description}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px]">
            {blog.word_count} words
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            target: {blog.target_keyword}
          </Badge>
        </div>

        {seo_suggestions.length > 0 && (
          <div className="rounded border border-border bg-muted/30 p-2">
            <InfoSection label="seo suggestions" bullets={seo_suggestions} />
          </div>
        )}

        <Collapsible>
          <CollapsibleTrigger className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
            Show full content
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 max-h-96 overflow-y-auto border border-border p-2 text-xs">
              <MarkdownMessage content={blog.content} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </AgentCard.Body>
      <AgentCard.Footer>
        <CopyButton text={blog.content} successLabel="Content copied" />
        <Button variant="outline" size="xs" onClick={downloadMd}>
          <Download data-icon="inline-start" /> Download .md
        </Button>
        {blog.wordpress_format && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => copyText(blog.wordpress_format!, "WordPress HTML copied")}
          >
            Copy WordPress
          </Button>
        )}
      </AgentCard.Footer>
    </AgentCard>
  )
}

// ─── Content audit card ──────────────────────────────────────────────────────

export function ContentAuditCard({ result }: { result: SageContentAnalysisResult }) {
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Gauge />}
        title="Content audit"
        right={<ScoreGauge score={result.score} label="score" />}
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <InfoSection label="issues" bullets={result.issues} />
          <InfoSection label="improvements" bullets={result.improvements} />
        </div>
        {result.missing_keywords.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Kicker prefix="//">missing keywords</Kicker>
            <div className="flex flex-wrap gap-1">
              {result.missing_keywords.map((k) => (
                <Badge key={k} variant="outline" className="text-[10px]">
                  {k}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Readability: {result.readability_grade}
        </p>
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Content brief card ──────────────────────────────────────────────────────

export function ContentBriefCard({ result }: { result: SageContentBriefResult }) {
  const b = result.brief
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<ClipboardList />}
        title="Content brief"
        badge={
          <Badge variant="secondary" className="text-[10px]">
            {b.content_type}
          </Badge>
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <Kicker prefix="//">search intent</Kicker>
            <p className="mt-0.5">{b.search_intent}</p>
          </div>
          <div>
            <Kicker prefix="//">target length</Kicker>
            <p className="mt-0.5">{b.recommended_word_count} words</p>
          </div>
        </div>
        <InfoSection label="title options" bullets={b.title_options} />
        <InfoSection label="h2 structure" ordered={b.h2_structure} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <InfoSection label="must answer" bullets={b.must_answer_questions} />
          <InfoSection label="competitor gaps" bullets={b.competitor_gaps} />
        </div>
        <p className="rounded border border-border bg-muted/30 p-2 text-[11px]">
          <strong>CTA:</strong> {b.cta_recommendation}
        </p>
      </AgentCard.Body>
    </AgentCard>
  )
}

// silence unused import lint when not strictly required
void Copy
