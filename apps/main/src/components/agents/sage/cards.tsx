"use client"

import * as React from "react"
import { toast } from "sonner"
import { Copy, Download, FileText, Search, Gauge, ClipboardList } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
      <span className={cn("text-lg font-semibold leading-none", color)}>{score}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(label))
}

// ─── Keyword Cluster Card ────────────────────────────────────────────────────

export function KeywordClusterCard({ result }: { result: SageKeywordResearchResult }) {
  const clusters = result.clusters ?? []
  const flatList = result.keywords ?? []

  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <Search className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Keyword research</p>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {flatList.length} keywords · {clusters.length} clusters
        </Badge>
      </div>
      <div className="flex flex-col gap-2">
        {clusters.map((c) => (
          <Collapsible key={c.cluster_name}>
            <div className="border border-border bg-muted/30 p-2">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="truncate text-xs font-medium">{c.cluster_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.keywords.length} keywords · {c.primary_intent}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {c.primary_intent}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 flex flex-col gap-1">
                  {c.keywords.map((k) => (
                    <div
                      key={k.keyword}
                      className="flex items-center gap-2 border border-border bg-background px-2 py-1.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs">{k.keyword}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {k.search_intent} · {k.suggested_content_type}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
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
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="xs"
          onClick={() =>
            copy(flatList.map((k) => k.keyword).join("\n"), "Keywords copied")
          }
        >
          <Copy data-icon="inline-start" /> Copy all keywords
        </Button>
      </div>
    </Card>
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
    <Card className="gap-3 p-3">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 size-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">{blog.title}</p>
          {blog.meta_description && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {blog.meta_description}
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px]">
              {blog.word_count} words
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              target: {blog.target_keyword}
            </Badge>
          </div>
        </div>
        <ScoreGauge score={seo_score} label="SEO" />
      </div>

      {seo_suggestions.length > 0 && (
        <div className="rounded border border-border bg-muted/30 p-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            SEO suggestions
          </p>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed">
            {seo_suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <Collapsible>
        <CollapsibleTrigger className="text-[10px] font-medium text-muted-foreground hover:text-foreground">
          Show full content
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 max-h-96 overflow-y-auto border border-border p-2 text-xs">
            <MarkdownMessage content={blog.content} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-wrap justify-end gap-1.5">
        <Button variant="outline" size="xs" onClick={() => copy(blog.content, "Content copied")}>
          <Copy data-icon="inline-start" /> Copy
        </Button>
        <Button variant="outline" size="xs" onClick={downloadMd}>
          <Download data-icon="inline-start" /> Download .md
        </Button>
        {blog.wordpress_format && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => copy(blog.wordpress_format!, "WordPress HTML copied")}
          >
            Copy WordPress
          </Button>
        )}
      </div>
    </Card>
  )
}

// ─── Content audit card ──────────────────────────────────────────────────────

export function ContentAuditCard({ result }: { result: SageContentAnalysisResult }) {
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <Gauge className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Content audit</p>
        <div className="ml-auto">
          <ScoreGauge score={result.score} label="score" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Issues
          </p>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed">
            {result.issues.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Improvements
          </p>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed">
            {result.improvements.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
      {result.missing_keywords.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Missing keywords
          </p>
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
    </Card>
  )
}

// ─── Content brief card ──────────────────────────────────────────────────────

export function ContentBriefCard({ result }: { result: SageContentBriefResult }) {
  const b = result.brief
  return (
    <Card className="gap-3 p-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Content brief</p>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {b.content_type}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Search intent
          </p>
          <p>{b.search_intent}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Target length
          </p>
          <p>{b.recommended_word_count} words</p>
        </div>
      </div>
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Title options
        </p>
        <ul className="list-disc pl-4 text-[11px] leading-relaxed">
          {b.title_options.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          H2 structure
        </p>
        <ol className="list-decimal pl-4 text-[11px] leading-relaxed">
          {b.h2_structure.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ol>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Must answer
          </p>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed">
            {b.must_answer_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Competitor gaps
          </p>
          <ul className="list-disc pl-4 text-[11px] leading-relaxed">
            {b.competitor_gaps.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="rounded border border-border bg-muted/30 p-2 text-[11px]">
        <strong>CTA:</strong> {b.cta_recommendation}
      </p>
    </Card>
  )
}
