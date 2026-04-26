"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  FileText,
  Heart,
  Search,
  Gauge,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Lightbulb,
  TrendingUp,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AgentCard } from "@/components/ui/agent-card"
import { CollapsibleSection } from "@/components/ui/collapsible-section"
import { CopyButton } from "@/components/ui/copy-button"
import { InfoSection } from "@/components/ui/info-section"
import { Kicker } from "@/components/ui/kicker"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import { useSavedKeywords, useSaveKeyword, useUnsaveKeyword } from "@/lib/api/sage"
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

  const { data: savedKeywords = [] } = useSavedKeywords()
  const saveMut = useSaveKeyword()
  const unsaveMut = useUnsaveKeyword()

  // Build a set of saved keyword strings for O(1) lookup
  const savedSet = React.useMemo(
    () => new Map(savedKeywords.map((sk) => [sk.keyword.toLowerCase(), sk.id])),
    [savedKeywords]
  )

  const toggleSave = async (kwStr: string, details: (typeof flatList)[0] | undefined) => {
    const savedId = savedSet.get(kwStr.toLowerCase())
    if (savedId) {
      await unsaveMut.mutateAsync(savedId)
      toast.success(`Removed "${kwStr}" from favourites`)
    } else {
      await saveMut.mutateAsync({
        keyword: kwStr,
        searchIntent: details?.search_intent ?? "",
        estimatedDifficulty: details?.estimated_difficulty ?? 50,
        relevanceScore: details?.relevance_score ?? 0.5,
        searchVolumeEstimate: details?.search_volume_estimate ?? null,
        suggestedContentType: details?.suggested_content_type ?? "",
      })
      toast.success(`Saved "${kwStr}" to favourites`)
    }
  }

  // Build lookup map for keyword details from flat list
  const kwMap = React.useMemo(
    () => new Map(flatList.map((k) => [k.keyword.toLowerCase(), k])),
    [flatList]
  )

  const csvContent = flatList
    .map(
      (k) =>
        `"${k.keyword}","${k.search_intent}","${k.estimated_difficulty}","${Math.round(k.relevance_score * 100)}%","${k.search_volume_estimate ?? "N/A"}","${k.suggested_content_type}"`
    )
    .join("\n")
  const csvWithHeader =
    `"Keyword","Intent","Difficulty","Relevance","Volume Estimate","Content Type"\n` +
    csvContent

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
                <div className="flex items-center justify-between px-2 pb-0.5">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">keyword</span>
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">
                    vol/mo · difficulty · relevance
                  </span>
                </div>
                {c.keywords.map((kwStr) => {
                  const details = kwMap.get(kwStr.toLowerCase())
                  const isSaved = savedSet.has(kwStr.toLowerCase())
                  return (
                    <div
                      key={kwStr}
                      className="flex items-center gap-2 border border-border bg-background px-2 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs">{kwStr}</p>
                        {details && (
                          <p className="text-[10px] text-muted-foreground">
                            {details.search_intent} · {details.suggested_content_type}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {details?.search_volume_estimate &&
                          details.search_volume_estimate !== "N/A" && (
                            <Badge variant="secondary" className="text-[10px]">
                              {details.search_volume_estimate}
                            </Badge>
                          )}
                        {details && (
                          <>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                details.estimated_difficulty >= 70
                                  ? "border-destructive/50 text-destructive"
                                  : details.estimated_difficulty >= 40
                                    ? "border-chart-3/50 text-chart-3"
                                    : "border-chart-2/50 text-chart-2"
                              )}
                            >
                              diff {details.estimated_difficulty}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {Math.round(details.relevance_score * 100)}%
                            </Badge>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 shrink-0"
                          title={isSaved ? "Remove from favourites" : "Save to favourites"}
                          onClick={() => toggleSave(kwStr, details)}
                          disabled={saveMut.isPending || unsaveMut.isPending}
                        >
                          <Heart
                            className={cn("size-3", isSaved ? "fill-destructive text-destructive" : "text-muted-foreground")}
                          />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CollapsibleSection>
          ))}

          {clusters.length === 0 && flatList.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between px-2 pb-0.5">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">keyword</span>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">
                  vol/mo · difficulty · relevance
                </span>
              </div>
              {flatList.map((k) => {
                const isSaved = savedSet.has(k.keyword.toLowerCase())
                return (
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
                      {k.search_volume_estimate && k.search_volume_estimate !== "N/A" && (
                        <Badge variant="secondary" className="text-[10px]">
                          {k.search_volume_estimate}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          k.estimated_difficulty >= 70
                            ? "border-destructive/50 text-destructive"
                            : k.estimated_difficulty >= 40
                              ? "border-chart-3/50 text-chart-3"
                              : "border-chart-2/50 text-chart-2"
                        )}
                      >
                        diff {k.estimated_difficulty}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {Math.round(k.relevance_score * 100)}%
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 shrink-0"
                        title={isSaved ? "Remove from favourites" : "Save to favourites"}
                        onClick={() => toggleSave(k.keyword, k)}
                        disabled={saveMut.isPending || unsaveMut.isPending}
                      >
                        <Heart
                          className={cn("size-3", isSaved ? "fill-destructive text-destructive" : "text-muted-foreground")}
                        />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </AgentCard.Body>
      <AgentCard.Footer>
        <CopyButton
          text={flatList.map((k) => k.keyword).join("\n")}
          label="Copy keywords"
          successLabel="Keywords copied"
        />
        <Button
          variant="outline"
          size="xs"
          onClick={() => copyText(csvWithHeader, "CSV copied")}
        >
          <Copy data-icon="inline-start" /> Copy as CSV
        </Button>
      </AgentCard.Footer>
    </AgentCard>
  )
}

// ─── Blog preview card ───────────────────────────────────────────────────────

// Blog-scale markdown renderer (larger than the chat MarkdownMessage)
function BlogContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-4 mt-0 text-2xl font-bold leading-tight tracking-tight">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 mt-8 text-xl font-semibold leading-snug">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-6 text-base font-semibold">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="mb-4 text-sm leading-[1.8] text-foreground">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-4 ml-5 list-disc space-y-1 text-sm">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-4 ml-5 list-decimal space-y-1 text-sm">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>
        ),
        pre: ({ children }) => (
          <pre className="mb-4 overflow-x-auto rounded-md bg-muted p-4 text-xs">{children}</pre>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-blue-600 underline underline-offset-2 hover:text-blue-800">
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-4 border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
        th: ({ children }) => (
          <th className="border-b border-border px-4 py-2.5 text-left text-xs font-semibold">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border-b border-border/50 px-4 py-2.5 text-xs">{children}</td>
        ),
        hr: () => <hr className="my-6 border-border" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export function BlogPreviewCard({ result }: { result: SageGenerateBlogResult }) {
  const { blog, seo_suggestions } = result
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [metaOpen, setMetaOpen] = React.useState(true)

  // HTML format: has structural HTML tags. Markdown: # headings, **bold**, |tables|
  const isHtml = /<(h[1-6]|p|div|section|article|ul|ol|table)[^>]*>/i.test(blog.content.slice(0, 1000))

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
    <>
      <AgentCard size="sm">
        <AgentCard.Header
          icon={<FileText />}
          title={blog.title}
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
              {blog.target_keyword}
            </Badge>
            {blog.secondary_keywords.slice(0, 3).map((kw) => (
              <Badge key={kw} variant="secondary" className="text-[10px]">
                {kw}
              </Badge>
            ))}
          </div>

          {/* SEO improvement tips */}
          {seo_suggestions.length > 0 && (
            <div className="flex flex-col gap-1">
              <Kicker prefix="//">SEO tips to strengthen this post</Kicker>
              <div className="flex flex-col gap-0.5">
                {seo_suggestions.map((s, i) => (
                  <p key={i} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                    <Lightbulb className="mt-0.5 size-3 shrink-0 text-chart-3" />
                    {s}
                  </p>
                ))}
              </div>
            </div>
          )}
        </AgentCard.Body>
        <AgentCard.Footer>
          <Button variant="outline" size="xs" onClick={() => setPreviewOpen(true)}>
            <Eye data-icon="inline-start" /> Preview
          </Button>
          <CopyButton text={blog.content} successLabel="Content copied" />
          <Button variant="outline" size="xs" onClick={downloadMd}>
            <Download data-icon="inline-start" /> Download .md
          </Button>
          {blog.wordpress_format && (
            <Button
              variant="outline"
              size="xs"
              onClick={() =>
                copyText(
                  JSON.stringify(blog.wordpress_format, null, 2),
                  "WordPress JSON copied"
                )
              }
            >
              Copy WordPress
            </Button>
          )}
        </AgentCard.Footer>
      </AgentCard>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="right" className="flex flex-col sm:max-w-[50vw]">
          <SheetHeader className="shrink-0 border-b pb-3">
            <SheetTitle className="pr-8 text-base leading-snug">{blog.title}</SheetTitle>
            <div className="flex flex-wrap gap-1 pt-1">
              <Badge variant="outline" className="text-[10px]">{blog.word_count} words</Badge>
              <Badge variant="outline" className="text-[10px]">{blog.target_keyword}</Badge>
              <Badge variant="secondary" className="text-[10px]">
                {isHtml ? "HTML" : "Markdown"}
              </Badge>
            </div>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            {/* Meta fields */}
            {(blog.meta_title || blog.meta_description || blog.slug || blog.schema_markup) && (
              <div className="mb-6 rounded-md border border-border bg-muted/30 text-[11px]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                  onClick={() => setMetaOpen((o) => !o)}
                >
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Meta / SEO fields</span>
                  {metaOpen
                    ? <ChevronUp className="size-3 text-muted-foreground" />
                    : <ChevronDown className="size-3 text-muted-foreground" />
                  }
                </button>
                {metaOpen && (
                  <div className="flex flex-col gap-2 border-t border-border px-4 pb-4 pt-3">
                    {blog.meta_title && (
                      <div className="flex items-start gap-2">
                        <span className="w-28 shrink-0 text-muted-foreground">Meta title</span>
                        <span className="flex-1 font-medium">{blog.meta_title}</span>
                        <Button variant="ghost" size="icon" className="size-5 shrink-0" onClick={() => copyText(blog.meta_title, "Meta title copied")}>
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    )}
                    {blog.meta_description && (
                      <div className="flex items-start gap-2">
                        <span className="w-28 shrink-0 text-muted-foreground">Meta description</span>
                        <span className="flex-1">{blog.meta_description}</span>
                        <Button variant="ghost" size="icon" className="size-5 shrink-0" onClick={() => copyText(blog.meta_description, "Meta description copied")}>
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    )}
                    {blog.slug && (
                      <div className="flex items-start gap-2">
                        <span className="w-28 shrink-0 text-muted-foreground">Slug</span>
                        <span className="flex-1 font-mono text-[10px]">/{blog.slug}</span>
                        <Button variant="ghost" size="icon" className="size-5 shrink-0" onClick={() => copyText(blog.slug!, "Slug copied")}>
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    )}
                    {blog.schema_markup && (
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground">Schema markup (JSON-LD)</span>
                        <div className="relative">
                          <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-[10px] leading-relaxed">
                            {JSON.stringify(blog.schema_markup, null, 2)}
                          </pre>
                          <Button
                            variant="ghost" size="icon" className="absolute right-1 top-1 size-5"
                            onClick={() => copyText(
                              `<script type="application/ld+json">\n${JSON.stringify(blog.schema_markup, null, 2)}\n</script>`,
                              "Schema markup copied"
                            )}
                          >
                            <Copy className="size-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {isHtml ? (
              // Raw HTML output from LLM — scope styles with Tailwind child selectors
              <div
                className="text-sm [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_li]:leading-relaxed [&_ol]:mb-4 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:mb-4 [&_p]:leading-[1.8] [&_table]:w-full [&_table]:border-collapse [&_table]:rounded [&_td]:border [&_td]:border-border/50 [&_td]:px-4 [&_td]:py-2.5 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-semibold [&_ul]:mb-4 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1"
                dangerouslySetInnerHTML={{ __html: blog.content }}
              />
            ) : (
              // Markdown output — rendered with react-markdown + GFM (handles tables, bold, etc.)
              <BlogContent content={blog.content} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
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
        {/* Stats row */}
        {(result.word_count || result.keyword_density) && (
          <div className="flex flex-wrap gap-1">
            {result.word_count != null && result.word_count > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {result.word_count} words
              </Badge>
            )}
            {result.keyword_density && (
              <Badge variant="outline" className="text-[10px]">
                keyword density {result.keyword_density}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              readability: {result.readability_grade}
            </Badge>
          </div>
        )}

        {/* Issues list with visual indicators */}
        {result.issues.length > 0 && (
          <div className="flex flex-col gap-1">
            <Kicker prefix="//">issues to fix</Kicker>
            <div className="flex flex-col gap-0.5">
              {result.issues.map((issue, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[11px]">
                  <XCircle className="mt-0.5 size-3 shrink-0 text-destructive" />
                  {issue}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Improvements */}
        {result.improvements.length > 0 && (
          <div className="flex flex-col gap-1">
            <Kicker prefix="//">improvements</Kicker>
            <div className="flex flex-col gap-0.5">
              {result.improvements.map((item, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[11px]">
                  <TrendingUp className="mt-0.5 size-3 shrink-0 text-chart-3" />
                  {item}
                </p>
              ))}
            </div>
          </div>
        )}

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

        {!result.word_count && !result.keyword_density && (
          <p className="text-[10px] text-muted-foreground">
            Readability: {result.readability_grade}
          </p>
        )}
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
          b.content_type ? (
            <Badge variant="secondary" className="text-[10px]">
              {b.content_type}
            </Badge>
          ) : undefined
        }
      />
      <AgentCard.Body className="flex flex-col gap-3">
        {/* Top stats */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <Kicker prefix="//">search intent</Kicker>
            <p className="mt-0.5 capitalize">{b.search_intent}</p>
          </div>
          <div>
            <Kicker prefix="//">target length</Kicker>
            <p className="mt-0.5">{b.recommended_word_count} words</p>
          </div>
        </div>

        {b.estimated_traffic_potential && (
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <TrendingUp className="size-3 shrink-0" />
            {b.estimated_traffic_potential}
          </p>
        )}

        {/* SERP features */}
        {b.serp_features && b.serp_features.length > 0 && (
          <div className="flex flex-col gap-1">
            <Kicker prefix="//">SERP features</Kicker>
            <div className="flex flex-wrap gap-1">
              {b.serp_features.map((f) => (
                <Badge key={f} variant="outline" className="text-[10px]">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Title options — copyable */}
        {b.title_options && b.title_options.length > 0 && (
          <div className="flex flex-col gap-1">
            <Kicker prefix="//">title options</Kicker>
            <div className="flex flex-col gap-1">
              {b.title_options.map((t, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-2 border border-border px-2 py-1.5"
                >
                  <p className="text-[11px]">{t}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 shrink-0"
                    onClick={() => copyText(t, "Title copied")}
                  >
                    <Copy className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* H2 structure */}
        <InfoSection label="h2 structure" ordered={b.h2_structure} />

        {/* Must cover + must answer */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <InfoSection label="must cover" bullets={b.must_include_topics} />
          <InfoSection label="must answer" bullets={b.must_answer_questions} />
        </div>

        {/* Competitor gaps — amber callout */}
        {b.competitor_gaps && b.competitor_gaps.length > 0 && (
          <div className="flex flex-col gap-1 rounded border border-chart-3/30 bg-chart-3/5 p-2">
            <Kicker prefix="//">competitor gaps to own</Kicker>
            <div className="flex flex-col gap-0.5">
              {b.competitor_gaps.map((gap, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[11px]">
                  <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-chart-3" />
                  {gap}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Internal linking */}
        {b.internal_linking_opportunities && b.internal_linking_opportunities.length > 0 && (
          <InfoSection label="internal links to add" bullets={b.internal_linking_opportunities} />
        )}

        {/* CTA recommendation */}
        {b.cta_recommendation && (
          <p className="rounded border border-border bg-muted/30 p-2 text-[11px]">
            <strong>CTA: </strong>
            {b.cta_recommendation}
          </p>
        )}

        {/* Topical authority tip */}
        {b.topical_authority_tip && (
          <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
            <Lightbulb className="mt-0.5 size-3 shrink-0 text-chart-2" />
            <em>{b.topical_authority_tip}</em>
          </p>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

void Copy
