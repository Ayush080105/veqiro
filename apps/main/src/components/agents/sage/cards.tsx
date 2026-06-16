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
  Globe,
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  Sparkles,
  PenLine,
  Zap,
  ShieldCheck,
  Image,
  BarChart3,
  ArrowRight,
  Users,
  Clock,
} from "lucide-react"
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

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
  SageGenerateBlogIdeasResult,
  SageBlogIdeaItem,
  SagePageSeoAuditResult,
  SageBatchAuditResult,
} from "@/lib/types/agents"
import type { AgentActionId } from "@/lib/types/agents"

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80 ? "text-chart-2" : score >= 60 ? "text-chart-3" : "text-destructive"
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("font-display text-lg leading-none", color)}>{score}</span>
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">
        {label}
      </span>
    </div>
  )
}

function copyText(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(label))
}

// ─── Keyword Cluster Card ────────────────────────────────────────────────────

export function KeywordClusterCard({
  result,
  onFollowUpAction,
}: {
  result: SageKeywordResearchResult
  onFollowUpAction?: (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
}) {
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
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">keyword</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
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
                        {onFollowUpAction && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 shrink-0"
                            title="Generate ideas · Maya"
                            onClick={() => onFollowUpAction("maya:generate-ideas", { topic_hint: kwStr })}
                          >
                            <Sparkles className="size-3 text-muted-foreground" />
                          </Button>
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
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">keyword</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
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
                      {onFollowUpAction && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 shrink-0"
                          title="Generate ideas · Maya"
                          onClick={() => onFollowUpAction("maya:generate-ideas", { topic_hint: k.keyword })}
                        >
                          <Sparkles className="size-3 text-muted-foreground" />
                        </Button>
                      )}
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
          variant="chat-utility"
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
          <Button variant="chat-utility" onClick={() => setPreviewOpen(true)}>
            <Eye data-icon="inline-start" /> Preview
          </Button>
          <CopyButton text={blog.content} successLabel="Content copied" />
          <Button variant="chat-utility" onClick={downloadMd}>
            <Download data-icon="inline-start" /> Download .md
          </Button>
          {blog.wordpress_format && (
            <Button
              variant="chat-utility"
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
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">Meta / SEO fields</span>
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
                        <Button variant="ghost" size="icon" className="size-5 shrink-0" onClick={() => copyText(blog.meta_title ?? "", "Meta title copied")}>
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    )}
                    {blog.meta_description && (
                      <div className="flex items-start gap-2">
                        <span className="w-28 shrink-0 text-muted-foreground">Meta description</span>
                        <span className="flex-1">{blog.meta_description}</span>
                        <Button variant="ghost" size="icon" className="size-5 shrink-0" onClick={() => copyText(blog.meta_description ?? "", "Meta description copied")}>
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

export function ContentBriefCard({
  result,
  onFollowUpAction,
}: {
  result: SageContentBriefResult
  onFollowUpAction?: (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
}) {
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

        {onFollowUpAction && b.title_options?.[0] && (
          <div className="flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
            <Button
              size="xs"
              variant="chat-action"
              onClick={() => onFollowUpAction("maya:draft-content", {
                topic: b.title_options[0],
                platform: "linkedin",
                additional_context: [b.cta_recommendation, b.topical_authority_tip].filter(Boolean).join("\n"),
              })}
            >
              <Sparkles className="size-3" /> Draft social post · Maya
            </Button>
          </div>
        )}
      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Blog ideas card ─────────────────────────────────────────────────────────

function difficultyColor(d: number) {
  if (d >= 70) return "border-destructive/50 text-destructive"
  if (d >= 40) return "border-chart-3/50 text-chart-3"
  return "border-chart-2/50 text-chart-2"
}

function IdeaCard({
  idea,
  onFollowUpAction,
}: {
  idea: SageBlogIdeaItem
  onFollowUpAction?: (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
}) {
  return (
    <div className="flex flex-col gap-2 border border-border bg-background p-3">
      {/* Title */}
      <p className="text-xs font-semibold leading-snug">{idea.title}</p>

      {/* Tags row */}
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant="outline" className="text-[10px]">
          {idea.target_keyword}
        </Badge>
        {idea.secondary_keywords.slice(0, 3).map((kw) => (
          <Badge key={kw} variant="secondary" className="text-[10px]">
            {kw}
          </Badge>
        ))}
        <Badge
          variant="outline"
          className={cn("text-[10px]", difficultyColor(idea.estimated_difficulty))}
        >
          diff {idea.estimated_difficulty}
        </Badge>
      </div>

      {/* Content angle */}
      {idea.content_angle && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {idea.content_angle}
        </p>
      )}

      {/* Rationale */}
      {idea.rationale && (
        <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground/80">
          <Lightbulb className="mt-0.5 size-3 shrink-0 text-chart-2" />
          {idea.rationale}
        </p>
      )}

      {onFollowUpAction && (
        <div className="flex gap-1.5 pt-0.5">
          <Button
            variant="chat-action"
            className="flex-1"
            onClick={() =>
              onFollowUpAction("sage:generate-blog", {
                topic: idea.title,
                target_keyword: idea.target_keyword,
                secondary_keywords: idea.secondary_keywords,
              })
            }
          >
            <PenLine className="size-3" />
            Write blog
          </Button>
          <Button
            variant="chat-action"
            className="flex-1"
            onClick={() =>
              onFollowUpAction("maya:draft-content", {
                topic: idea.title,
                platform: "linkedin",
                additional_context: [idea.content_angle, idea.rationale].filter(Boolean).join("\n"),
              })
            }
          >
            <Sparkles className="size-3" />
            Post about this · Maya
          </Button>
        </div>
      )}
    </div>
  )
}

export function BlogIdeasCard({
  result,
  onFollowUpAction,
}: {
  result: SageGenerateBlogIdeasResult
  onFollowUpAction?: (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
}) {
  const ideas = result.ideas ?? []
  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Sparkles />}
        title="Blog ideas"
        badge={
          <Badge variant="secondary" className="text-[10px]">
            {ideas.length} ideas
          </Badge>
        }
      />
      <AgentCard.Body>
        <div className="flex flex-col gap-2">
          {ideas.map((idea, i) => (
            <IdeaCard key={i} idea={idea} onFollowUpAction={onFollowUpAction} />
          ))}
          {ideas.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No ideas generated.</p>
          )}
        </div>
      </AgentCard.Body>
    </AgentCard>
  )
}

void Copy

// ─── Shared helpers for SEO audit cards ─────────────────────────────────────

function scoreColor(score: number) {
  return score >= 80 ? "text-chart-2" : score >= 60 ? "text-chart-3" : "text-destructive"
}

function scoreBg(score: number) {
  return score >= 80 ? "bg-chart-2" : score >= 60 ? "bg-chart-3" : "bg-destructive"
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80
      ? "border-chart-2/40 text-chart-2"
      : score >= 60
        ? "border-chart-3/40 text-chart-3"
        : "border-destructive/40 text-destructive"
  return (
    <Badge variant="outline" className={cn("text-[9px] font-mono", color)}>
      {label} {score}
    </Badge>
  )
}

/** A check row with an optional context line explaining the "why". */
function RichCheckRow({ ok, label, context }: { ok: boolean; label: string; context?: string }) {
  return (
    <div className="flex items-start gap-1.5">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-chart-2" />
      ) : (
        <XCircle className="mt-0.5 size-3 shrink-0 text-destructive" />
      )}
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] leading-tight">{label}</span>
        {context && (
          <span className="text-[10px] leading-tight text-muted-foreground">{context}</span>
        )}
      </div>
    </div>
  )
}

function IssueRow({ issue }: { issue: string }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px]">
      <XCircle className="mt-0.5 size-3 shrink-0 text-destructive" />
      {issue}
    </p>
  )
}

function WinRow({ win }: { win: string }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px]">
      <Zap className="mt-0.5 size-3 shrink-0 text-chart-3" />
      {win}
    </p>
  )
}

/** Thin horizontal progress bar (0–100). */
function MiniBar({ value, max = 100, label, note }: { value: number; max?: number; label: string; note?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100))
  const color = pct >= 80 ? "bg-chart-2" : pct >= 50 ? "bg-chart-3" : "bg-destructive"
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px]">{label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{value}{max !== 100 ? `/${max}` : "%"}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted">
        <div className={cn("h-1 rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      {note && <span className="text-[9px] text-muted-foreground">{note}</span>}
    </div>
  )
}

/** Circular SVG score ring for the overall score. */
function ScoreRing({ score }: { score: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444"
  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} strokeWidth="5" className="stroke-muted" fill="none" />
        <circle
          cx="36" cy="36" r={r} strokeWidth="5" fill="none"
          stroke={color}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-base leading-none" style={{ color }}>{score}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">score</span>
      </div>
    </div>
  )
}

// ─── Page SEO Audit Card ─────────────────────────────────────────────────────

const emptyUrlAnalysis = {
  url: "",
  is_https: false,
  keyword_in_slug: false,
  url_length: 0,
  url_depth: 0,
  has_stop_words: false,
  slug: "",
  score: 0,
  issues: [],
}

const emptyTechnicalAudit = {
  score: 0,
  title: "",
  title_length: 0,
  title_has_keyword: false,
  title_has_brand: false,
  meta_description: "",
  meta_description_length: 0,
  meta_description_has_keyword: false,
  meta_description_has_cta: false,
  has_canonical: false,
  canonical_url: null,
  canonical_is_self: false,
  is_indexable: false,
  is_followable: false,
  h1_count: 0,
  h1_text: "",
  h1_has_keyword: false,
  h2_count: 0,
  h3_count: 0,
  keyword_in_h2: false,
  heading_hierarchy_valid: false,
  heading_hierarchy_issues: [],
  has_schema_markup: false,
  schema_types: [],
  schema_issues: [],
  schema_eligible_rich_results: [],
  has_og_tags: false,
  og_title: "",
  og_description: "",
  og_image: "",
  has_twitter_card: false,
  has_viewport: false,
  has_hreflang: false,
  has_preconnect_hints: false,
  issues: [],
}

const emptySpeedSignals = {
  score: 0,
  render_blocking_scripts: 0,
  render_blocking_stylesheets: 0,
  total_external_requests: 0,
  images_lazy_loaded: 0,
  images_not_lazy_loaded: 0,
  images_using_modern_format: 0,
  images_total: 0,
  has_inline_critical_css: false,
  has_font_preloading: false,
  issues: [],
}

const emptyImageAudit = {
  score: 0,
  images_total: 0,
  images_missing_alt: 0,
  images_with_descriptive_alt: 0,
  images_with_generic_alt: 0,
  images_with_keyword_filename: 0,
  images_with_dimensions: 0,
  images_without_dimensions: 0,
  webp_avif_percentage: 0,
  issues: [],
}

const emptyOnPageAudit = {
  score: 0,
  word_count: 0,
  reading_time_minutes: 0,
  keyword_density: "0%",
  keyword_occurrences: 0,
  keyword_in_title: false,
  keyword_in_h1: false,
  keyword_in_meta: false,
  keyword_in_first_100_words: false,
  keyword_in_h2s: false,
  keyword_in_last_paragraph: false,
  lsi_keywords_found: [],
  lsi_keywords_missing: [],
  paa_answered: [],
  paa_unanswered: [],
  has_featured_snippet_structure: false,
  featured_snippet_type: null,
  has_faq_section: false,
  content_freshness: null,
  last_modified: null,
  readability_grade: "",
  content_depth_assessment: "",
  anchor_text_generic_count: 0,
  anchor_text_descriptive_count: 0,
  issues: [],
  improvements: [],
}

const emptyEeatAudit = {
  score: 0,
  has_author_byline: false,
  has_author_bio: false,
  has_publication_date: false,
  has_updated_date: false,
  has_external_citations: false,
  citation_count: 0,
  has_authoritative_citations: false,
  has_trust_links: false,
  has_social_proof_schema: false,
  credentials_signals: [],
  missing_signals: [],
  issues: [],
}

const emptyCompetitiveAudit = {
  score: 0,
  serp_features_present: [],
  serp_features_missing: [],
  avg_competitor_word_count: 0,
  your_word_count: 0,
  word_count_gap: 0,
  word_count_verdict: "",
  top_competitors: [],
  content_gaps: [],
  unique_angle_opportunity: "",
  featured_snippet_holder: null,
  featured_snippet_format: null,
  featured_snippet_tip: "",
  paa_questions: [],
  competitor_schema_types: [],
}

export function PageSeoAuditCard({
  result,
  onFollowUpAction,
}: {
  result: SagePageSeoAuditResult
  onFollowUpAction?: (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
}) {
  const urlAnalysis = { ...emptyUrlAnalysis, ...result.url_analysis }
  const t = { ...emptyTechnicalAudit, ...result.technical }
  const speed = { ...emptySpeedSignals, ...result.speed_signals }
  const img = { ...emptyImageAudit, ...result.image_seo }
  const op = { ...emptyOnPageAudit, ...result.on_page }
  const eeat = { ...emptyEeatAudit, ...result.eeat }
  const comp = { ...emptyCompetitiveAudit, ...result.competitive }
  const pageUrl = result.url ?? urlAnalysis.url ?? ""
  const overallScore = result.overall_score ?? (result as { score?: number }).score ?? 0
  const competitors = comp.top_competitors.map((competitor) => ({
    ...competitor,
    url: competitor.url ?? "",
    title: competitor.title ?? "",
    meta_description: competitor.meta_description ?? "",
    word_count_estimate: competitor.word_count_estimate ?? 0,
    main_h2s: competitor.main_h2s ?? [],
    schema_types: competitor.schema_types ?? [],
    main_topics: competitor.main_topics ?? [],
  }))

  // Radar chart data — 7 SEO dimensions
  const radarData = [
    { dim: "URL", score: urlAnalysis.score },
    { dim: "Technical", score: t.score },
    { dim: "Speed", score: speed.score },
    { dim: "Images", score: img.score },
    { dim: "On-Page", score: op.score },
    { dim: "E-E-A-T", score: eeat.score },
    { dim: "Competitive", score: comp.score },
  ]

  // Word count bar — you vs top competitors
  const wcData = [
    { name: "You", words: comp.your_word_count, fill: "var(--chart-1)" },
    ...competitors.slice(0, 3).map((c, i) => ({
      name: c.title?.split(" ").slice(0, 2).join(" ") || `Competitor ${i + 1}`,
      words: c.word_count_estimate,
      fill: "var(--muted-foreground)",
    })),
  ]
  // Sort descending for visual clarity
  wcData.sort((a, b) => b.words - a.words)

  const titleLen = t.title_length
  const metaLen = t.meta_description_length

  return (
    <AgentCard size="sm">
      <AgentCard.Header
        icon={<Gauge />}
        title={
          <span className="flex flex-col gap-0.5">
            <span>Page SEO Audit</span>
            <span className="max-w-55 truncate text-[10px] font-normal text-muted-foreground">
              {pageUrl.replace(/^https?:\/\//, "") || "Unknown URL"}
            </span>
          </span>
        }
        right={<ScoreRing score={overallScore} />}
      />
      <AgentCard.Body className="flex flex-col gap-4">

        {/* ── Radar chart + score breakdown ── */}
        <div className="flex items-center gap-3">
          {/* Radar */}
          <div className="shrink-0" style={{ width: 160, height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
                <PolarGrid stroke="var(--border)" strokeOpacity={0.5} />
                <PolarAngleAxis
                  dataKey="dim"
                  tick={{ fontSize: 8, fill: "var(--muted-foreground)" }}
                />
                <Radar
                  dataKey="score"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.2}
                  strokeWidth={1.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {/* Dimension scores list */}
          <div className="flex flex-1 flex-col gap-1">
            {radarData.map(({ dim, score }) => (
              <div key={dim} className="flex items-center gap-1.5">
                <span className="w-16 text-[9px] text-muted-foreground">{dim}</span>
                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", scoreBg(score))}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className={cn("w-6 text-right font-mono text-[9px]", scoreColor(score))}>{score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mentor summary ── */}
        {result.mentor_summary && (
          <div className="rounded border border-border/60 bg-muted/20 px-3 py-2.5">
            <p className="text-sm leading-relaxed text-foreground">{result.mentor_summary}</p>
            {result.next_move && (
              <div className="mt-2 flex items-start gap-1.5 border-t border-border/40 pt-2">
                <ArrowRight className="mt-0.5 size-3 shrink-0 text-chart-2" />
                <p className="text-[11px] font-semibold leading-tight text-chart-2">{result.next_move}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Priority actions (critical | high priority | quick wins) ── */}
        {(result.critical_issues?.length > 0 || result.quick_wins?.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {result.critical_issues?.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Kicker prefix="//">must fix</Kicker>
                {result.critical_issues.slice(0, 4).map((issue, i) => (
                  <IssueRow key={i} issue={issue} />
                ))}
              </div>
            )}
            {result.quick_wins?.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Kicker prefix="//">quick wins</Kicker>
                {result.quick_wins.slice(0, 4).map((win, i) => (
                  <WinRow key={i} win={win} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Technical SEO ── */}
        <CollapsibleSection
          title={<span className="flex items-center gap-1.5"><Gauge className="size-3" />Technical SEO <ScoreBadge score={t.score} label="" /></span>}
          defaultOpen
        >
          <div className="flex flex-col gap-2">
            <RichCheckRow
              ok={!!t.title && titleLen >= 30 && titleLen <= 65}
              label={t.title ? `Title tag: "${t.title.slice(0, 52)}${t.title.length > 52 ? "…" : ""}" · ${titleLen} chars` : "Title tag is missing"}
              context={!t.title ? "A title tag is the most important on-page SEO element — Google shows it in search results." : titleLen < 30 ? "Too short — Google may rewrite it. Aim for 50–60 characters." : titleLen > 65 ? "Too long — will be truncated in the SERP. Trim to under 60 characters." : t.title_has_keyword ? "Keyword present in title — good for relevance signals." : "Target keyword is missing from the title — this directly hurts rankings."}
            />
            <RichCheckRow
              ok={!!t.meta_description && metaLen >= 120 && metaLen <= 160}
              label={t.meta_description ? `Meta description: ${metaLen} characters` : "Meta description missing"}
              context={!t.meta_description ? "Missing meta descriptions hurt CTR — Google writes one for you, often poorly." : metaLen < 120 ? "Too short to be compelling. Write 130–155 characters with a clear CTA." : metaLen > 160 ? "Will be cut off in search results. Trim below 160 characters." : t.meta_description_has_cta ? "Good length with a call-to-action — helps improve click-through rate." : "Good length, but add a CTA (e.g. 'Learn how', 'Get started') to improve CTR."}
            />
            <RichCheckRow
              ok={t.is_indexable}
              label={t.is_indexable ? "Page is indexable by Google" : "noindex tag detected — Google will NOT index this page"}
              context={!t.is_indexable ? "Critical: remove the noindex directive unless this page is intentionally excluded from search." : "Google can discover and rank this page from search."}
            />
            <RichCheckRow
              ok={t.h1_count === 1}
              label={t.h1_count === 0 ? "No H1 tag found" : t.h1_count > 1 ? `${t.h1_count} H1 tags found (should be exactly 1)` : `H1: "${t.h1_text.slice(0, 50)}${t.h1_text.length > 50 ? "…" : ""}"`}
              context={t.h1_count === 0 ? "H1 is the page's main heading — Google uses it to understand the topic. Add one that includes your target keyword." : t.h1_count > 1 ? "Multiple H1s confuse Google about the main topic. Keep only one." : t.h1_has_keyword ? "H1 contains the target keyword — great for topical relevance." : "H1 doesn't contain the target keyword — include it naturally for a relevance boost."}
            />
            {t.has_canonical && (
              <RichCheckRow
                ok={t.canonical_is_self}
                label={t.canonical_is_self ? "Canonical URL points to this page (self-referential)" : `Canonical points elsewhere: ${t.canonical_url}`}
                context={!t.canonical_is_self ? "If this is the primary URL, update the canonical to point to itself to avoid sending link equity elsewhere." : "Prevents duplicate content issues — tells Google this is the authoritative version."}
              />
            )}
            {!t.has_canonical && (
              <RichCheckRow
                ok={false}
                label="No canonical URL tag"
                context="Without a canonical, Google may choose a different version of this page as the 'master'. Add <link rel='canonical'> pointing to this URL."
              />
            )}
            <RichCheckRow
              ok={t.has_schema_markup}
              label={t.has_schema_markup ? `Schema markup detected: ${t.schema_types.join(", ")}` : "No structured data (schema markup) found"}
              context={!t.has_schema_markup ? "Schema markup enables rich results in Google (star ratings, FAQs, breadcrumbs). Start with Article or BreadcrumbList." : t.schema_eligible_rich_results.length > 0 ? `Eligible for: ${t.schema_eligible_rich_results.join(", ")}` : "Check schema completeness — missing required properties reduce eligibility for rich results."}
            />
            <RichCheckRow
              ok={t.has_og_tags}
              label={t.has_og_tags ? "Open Graph tags present (og:title, og:description, og:image)" : "Open Graph tags missing"}
              context={!t.has_og_tags ? "OG tags control how this page appears when shared on LinkedIn, X, and Slack. Missing them leads to ugly, unoptimized link previews." : !t.og_image ? "og:image is missing — social shares won't show a preview image." : "Social sharing will display a rich preview with title, description, and image."}
            />
            <RichCheckRow
              ok={t.has_twitter_card}
              label={t.has_twitter_card ? "Twitter/X card meta present" : "Twitter/X card meta missing"}
              context={!t.has_twitter_card ? "Without a twitter:card meta tag, links shared on X show as plain text. Add <meta name='twitter:card' content='summary_large_image'>." : "X (Twitter) will show a rich card when this page is shared."}
            />
            <RichCheckRow
              ok={t.heading_hierarchy_valid}
              label={t.heading_hierarchy_valid ? "Heading hierarchy is logical (H1 → H2 → H3)" : `Heading structure issues: ${t.heading_hierarchy_issues[0] ?? "invalid order"}`}
              context={!t.heading_hierarchy_valid ? "Skipping heading levels (e.g. H1 → H3) confuses both users and search engines. Fix the outline to flow logically." : "Well-structured headings help Google understand the content hierarchy and improve featured snippet eligibility."}
            />
            {t.schema_issues.length > 0 && (
              <div className="mt-1 flex flex-col gap-0.5 rounded bg-chart-3/5 px-2 py-1.5">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-chart-3">Schema issues to fix</p>
                {t.schema_issues.slice(0, 3).map((issue, i) => (
                  <p key={i} className="flex items-start gap-1 text-[10px] text-foreground/70">
                    <AlertTriangle className="mt-0.5 size-2.5 shrink-0 text-chart-3" /> {issue}
                  </p>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* ── Speed Signals ── */}
        <CollapsibleSection
          title={<span className="flex items-center gap-1.5"><Zap className="size-3 text-chart-3" />Page Speed Signals <ScoreBadge score={speed.score} label="" /></span>}
          defaultOpen={false}
        >
          <div className="flex flex-col gap-3">
            <p className="text-[10px] text-muted-foreground">Signals detected from HTML — no browser rendering needed. Core Web Vitals (LCP, CLS, FID) require a real test in Google Search Console or PageSpeed Insights.</p>
            <div className="flex flex-col gap-2">
              <RichCheckRow
                ok={speed.render_blocking_scripts <= 2}
                label={`${speed.render_blocking_scripts} render-blocking ${speed.render_blocking_scripts === 1 ? "script" : "scripts"} in <head>`}
                context={speed.render_blocking_scripts > 2 ? `Each blocking script delays the browser from rendering anything on screen. Add defer or async attribute to non-critical scripts. Found ${speed.render_blocking_scripts} — aim for 0.` : speed.render_blocking_scripts > 0 ? "Minor — 1–2 blocking scripts are usually manageable, but removing them will improve FCP." : "No render-blocking scripts detected — the browser can paint the page immediately."}
              />
              <RichCheckRow
                ok={speed.render_blocking_stylesheets === 0}
                label={`${speed.render_blocking_stylesheets} render-blocking ${speed.render_blocking_stylesheets === 1 ? "stylesheet" : "stylesheets"}`}
                context={speed.render_blocking_stylesheets > 0 ? "External CSS blocks rendering. Inline critical above-the-fold CSS in <style> and lazy-load the rest." : "Good — no blocking stylesheets slowing the initial paint."}
              />
              <RichCheckRow
                ok={speed.images_not_lazy_loaded === 0}
                label={`${speed.images_not_lazy_loaded} images loaded eagerly (not lazy)`}
                context={speed.images_not_lazy_loaded > 3 ? `Add loading="lazy" to below-the-fold images. This is one of the easiest LCP improvements available. ${speed.images_not_lazy_loaded} images are currently loading on page start.` : speed.images_not_lazy_loaded > 0 ? "A few images without lazy loading — fine unless they're large and below the fold." : "All images are lazy-loaded — browser only fetches images as they scroll into view."}
              />
              <RichCheckRow
                ok={speed.has_inline_critical_css}
                label={speed.has_inline_critical_css ? "Inline critical CSS detected in <head>" : "No inline critical CSS detected"}
                context={!speed.has_inline_critical_css ? "Inlining above-the-fold CSS directly in <style> eliminates a render-blocking stylesheet request and improves First Contentful Paint (FCP)." : "Above-the-fold styles are inlined — page can render without waiting for an external CSS file."}
              />
              <RichCheckRow
                ok={speed.has_font_preloading}
                label={speed.has_font_preloading ? "Font preloading found (<link rel='preload' as='font'>)" : "No font preloading detected"}
                context={!speed.has_font_preloading ? "Custom fonts are a common cause of FOUT (Flash of Unstyled Text). Preloading them eliminates layout shift caused by font swaps." : "Fonts are preloaded — text will render in the correct typeface from the first paint."}
              />
              {speed.images_total > 0 && (
                <div className="mt-1">
                  <MiniBar
                    value={speed.images_using_modern_format}
                    max={speed.images_total}
                    label="Images using WebP or AVIF"
                    note={speed.images_using_modern_format / speed.images_total < 0.5 ? "Converting images to WebP typically reduces file size by 25–35% vs JPEG. Use Squoosh, Sharp, or your CDN's image pipeline." : "Good modern format adoption — users on fast connections won't notice, but mobile users on slow connections will."}
                  />
                </div>
              )}
              {speed.total_external_requests > 0 && (
                <RichCheckRow
                  ok={speed.total_external_requests <= 15}
                  label={`${speed.total_external_requests} external resource requests`}
                  context={speed.total_external_requests > 20 ? "High number of third-party requests (scripts, fonts, tracking pixels) add latency — each is a new DNS lookup + connection. Audit and remove non-essential third-party scripts." : speed.total_external_requests > 10 ? "Moderate third-party load — consider whether all are necessary, especially tracking scripts." : "Low third-party request count — good for performance and user privacy."}
                />
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* ── Image SEO ── */}
        <CollapsibleSection
          title={<span className="flex items-center gap-1.5"><Image className="size-3" />Image SEO <ScoreBadge score={img.score} label="" /></span>}
          defaultOpen={false}
        >
          <div className="flex flex-col gap-2">
            {img.images_total === 0 ? (
              <p className="text-[10px] text-muted-foreground">No images found on this page.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded border border-border/40 px-2 py-1.5 text-center">
                    <p className="font-display text-base">{img.images_total}</p>
                    <p className="text-[9px] text-muted-foreground">total images</p>
                  </div>
                  <div className={cn("rounded border px-2 py-1.5 text-center", img.images_missing_alt > 0 ? "border-destructive/30" : "border-chart-2/30")}>
                    <p className={cn("font-display text-base", img.images_missing_alt > 0 ? "text-destructive" : "text-chart-2")}>{img.images_missing_alt}</p>
                    <p className="text-[9px] text-muted-foreground">missing alt text</p>
                  </div>
                </div>
                <MiniBar
                  value={img.webp_avif_percentage}
                  label="Modern format (WebP/AVIF) %"
                  note={img.webp_avif_percentage < 30 ? "Convert images to WebP — typically 25–35% smaller than JPEG with the same visual quality. Use your CDN or a tool like Squoosh." : img.webp_avif_percentage < 70 ? "Good start — keep converting remaining images to modern formats." : "Excellent — most images are in an efficient modern format."}
                />
                <RichCheckRow
                  ok={img.images_missing_alt === 0}
                  label={img.images_missing_alt === 0 ? "All images have alt text" : `${img.images_missing_alt} images are missing alt text`}
                  context={img.images_missing_alt > 0 ? "Alt text serves two purposes: Google reads it as image content (important for Image Search rankings), and screen readers use it for accessibility. Both affect your site's authority." : "Good — all images have alt descriptions for both SEO and accessibility."}
                />
                <RichCheckRow
                  ok={img.images_with_descriptive_alt > img.images_with_generic_alt}
                  label={`${img.images_with_descriptive_alt} descriptive alts vs ${img.images_with_generic_alt} generic`}
                  context={img.images_with_generic_alt > 2 ? "Generic alts like 'image' or 'photo' provide no SEO value. Write descriptive alts that explain what the image shows and include the target keyword where natural." : "Most alts are descriptive — keep it up as you add new images."}
                />
                <RichCheckRow
                  ok={img.images_without_dimensions === 0}
                  label={img.images_without_dimensions === 0 ? "All images have width & height attributes" : `${img.images_without_dimensions} images missing width/height attributes`}
                  context={img.images_without_dimensions > 0 ? "Missing dimensions cause Cumulative Layout Shift (CLS) — the page 'jumps' as images load. This hurts both UX and Core Web Vitals. Add explicit width and height to all img tags." : "Explicit dimensions prevent layout shift — good for CLS score."}
                />
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* ── On-Page Content ── */}
        <CollapsibleSection
          title={<span className="flex items-center gap-1.5"><FileText className="size-3" />On-Page Content <ScoreBadge score={op.score} label="" /></span>}
          defaultOpen={false}
        >
          <div className="flex flex-col gap-2.5">
            {/* Content stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center rounded border border-border/40 px-1 py-1.5">
                <span className="font-display text-sm">{op.word_count.toLocaleString()}</span>
                <span className="text-[9px] text-muted-foreground">words</span>
              </div>
              <div className="flex flex-col items-center rounded border border-border/40 px-1 py-1.5">
                <span className="font-display text-sm">{op.reading_time_minutes}</span>
                <span className="text-[9px] text-muted-foreground">min read</span>
              </div>
              <div className="flex flex-col items-center rounded border border-border/40 px-1 py-1.5">
                <span className="font-display text-sm">{op.keyword_density}</span>
                <span className="text-[9px] text-muted-foreground">kw density</span>
              </div>
            </div>

            {(op.readability_grade || op.content_depth_assessment) && (
              <div className="rounded bg-muted/20 px-2.5 py-2">
                {op.readability_grade && <p className="text-[10px]"><span className="font-bold">Readability:</span> {op.readability_grade}</p>}
                {op.content_depth_assessment && <p className="mt-0.5 text-[10px] text-foreground/80">{op.content_depth_assessment}</p>}
              </div>
            )}

            {/* Keyword placement */}
            <div>
              <Kicker prefix="//">keyword placement</Kicker>
              <div className="mt-1 flex flex-col gap-1">
                <RichCheckRow
                  ok={op.keyword_in_title}
                  label={op.keyword_in_title ? "Keyword in title tag" : "Target keyword missing from title tag"}
                  context="Title tag keyword placement is one of the strongest on-page ranking signals."
                />
                <RichCheckRow
                  ok={op.keyword_in_h1}
                  label={op.keyword_in_h1 ? "Keyword in H1 heading" : "Target keyword missing from H1"}
                  context="The H1 is the semantic main heading — include the keyword naturally here."
                />
                <RichCheckRow
                  ok={op.keyword_in_meta}
                  label={op.keyword_in_meta ? "Keyword in meta description" : "Target keyword not in meta description"}
                  context="Google bolds the keyword in the meta description in search results — helps with click-through rate."
                />
                <RichCheckRow
                  ok={op.keyword_in_first_100_words}
                  label={op.keyword_in_first_100_words ? "Keyword appears in the first 100 words" : "Keyword missing from the opening paragraph"}
                  context={op.keyword_in_first_100_words ? "Strong relevance signal — Google weights keywords higher when they appear early in the content." : "Add the target keyword within the first paragraph. Google reads above-the-fold content more heavily."}
                />
                <RichCheckRow
                  ok={op.keyword_in_h2s}
                  label={op.keyword_in_h2s ? "Keyword found in at least one H2 subheading" : "Keyword not found in any H2 heading"}
                  context={!op.keyword_in_h2s ? "Using the keyword (or a close variation) in a subheading reinforces topical depth and helps Googlebot understand sub-sections." : "Good — keyword variations in H2s build topical depth."}
                />
              </div>
            </div>

            {/* Featured snippet potential */}
            <RichCheckRow
              ok={op.has_featured_snippet_structure}
              label={op.featured_snippet_type ? `Featured snippet structure found: ${op.featured_snippet_type.replace(/_/g, " ")}` : "No featured snippet structure detected"}
              context={!op.has_featured_snippet_structure ? "Featured snippets (position zero) drive 35%+ CTR for some queries. Add a structured element: a numbered list for 'how to', a definition block for 'what is', or a comparison table for 'best X vs Y'." : "This page has content structures (list, table, or definition) that Google can extract for featured snippets. Make sure the answer is concise and directly follows the question."}
            />
            <RichCheckRow
              ok={op.has_faq_section}
              label={op.has_faq_section ? "FAQ section detected" : "No FAQ section found"}
              context={!op.has_faq_section ? `You have ${op.paa_unanswered.length} unanswered People Also Ask questions. Adding an FAQ section with these answers is one of the fastest ways to capture SERP real estate.` : "FAQ content can trigger FAQPage rich results and directly answer People Also Ask questions in your SERP listing."}
            />

            {/* LSI keywords */}
            {(op.lsi_keywords_found.length > 0 || op.lsi_keywords_missing.length > 0) && (
              <div>
                <Kicker prefix="//">semantic keyword coverage</Kicker>
                <p className="mt-1 text-[10px] text-muted-foreground">LSI (Latent Semantic Indexing) keywords are related terms Google expects to see on a page that genuinely covers this topic.</p>
                {op.lsi_keywords_found.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-0.5">
                    {op.lsi_keywords_found.slice(0, 6).map((k) => (
                      <Badge key={k} variant="secondary" className="text-[9px]">✓ {k}</Badge>
                    ))}
                  </div>
                )}
                {op.lsi_keywords_missing.length > 0 && (
                  <>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">Add these missing terms naturally to improve topical depth:</p>
                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                      {op.lsi_keywords_missing.slice(0, 7).map((k) => (
                        <Badge key={k} variant="outline" className="text-[9px] border-chart-3/40 text-chart-3">{k}</Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* PAA questions */}
            {(op.paa_answered.length > 0 || op.paa_unanswered.length > 0) && (
              <div>
                <Kicker prefix="//">people also ask coverage</Kicker>
                {op.paa_answered.length > 0 && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {op.paa_answered.map((q, i) => (
                      <p key={i} className="flex items-start gap-1 text-[10px]">
                        <CheckCircle2 className="mt-0.5 size-2.5 shrink-0 text-chart-2" /> {q}
                      </p>
                    ))}
                  </div>
                )}
                {op.paa_unanswered.length > 0 && (
                  <>
                    <p className="mt-1.5 text-[10px] font-bold text-chart-3">{op.paa_unanswered.length} unanswered PAA questions — add these to your FAQ or body content:</p>
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {op.paa_unanswered.slice(0, 4).map((q, i) => (
                        <p key={i} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                          <AlertTriangle className="mt-0.5 size-2.5 shrink-0 text-chart-3" /> {q}
                        </p>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Content freshness */}
            {(op.content_freshness || op.last_modified) && (
              <div className="flex gap-3 text-[10px]">
                {op.content_freshness && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-2.5" />Published: {op.content_freshness}
                  </span>
                )}
                {op.last_modified && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-2.5" />Updated: {op.last_modified}
                  </span>
                )}
              </div>
            )}
            {!op.content_freshness && (
              <p className="text-[10px] text-chart-3">⚠ No publication date detected — add datePublished to your Article schema or a meta article:published_time tag. Google values content freshness for competitive queries.</p>
            )}
          </div>
        </CollapsibleSection>

        {/* ── E-E-A-T ── */}
        <CollapsibleSection
          title={<span className="flex items-center gap-1.5"><ShieldCheck className="size-3 text-chart-2" />E-E-A-T Authority <ScoreBadge score={eeat.score} label="" /></span>}
          defaultOpen={false}
        >
          <div className="flex flex-col gap-2">
            <p className="text-[10px] text-muted-foreground">E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) is Google's framework for evaluating content quality — especially critical for YMYL topics (health, finance, legal).</p>
            <RichCheckRow
              ok={eeat.has_author_byline}
              label={eeat.has_author_byline ? "Author byline detected" : "No author byline found"}
              context={!eeat.has_author_byline ? "Add 'By [Author Name]' near the top of the article. Google's Quality Raters Guidelines specifically look for authorship as an expertise signal." : "Author attribution is present — a strong E-E-A-T trust signal for Google."}
            />
            <RichCheckRow
              ok={eeat.has_author_bio}
              label={eeat.has_author_bio ? "Author bio section found" : "No author bio section"}
              context={!eeat.has_author_bio ? "A short author bio (3–4 sentences covering credentials and expertise) significantly boosts E-E-A-T. Link it to a dedicated author page for extra authority." : "Author bio present — this establishes the 'Expertise' component of E-E-A-T."}
            />
            <RichCheckRow
              ok={eeat.has_publication_date}
              label={eeat.has_publication_date ? "Publication date present" : "No publication date found"}
              context={!eeat.has_publication_date ? "Google factors content freshness into rankings. Add datePublished (and dateModified) to your Article JSON-LD schema." : "Publication date is present — Google can assess freshness relative to competitor content."}
            />
            <RichCheckRow
              ok={eeat.has_external_citations}
              label={eeat.citation_count > 0 ? `${eeat.citation_count} external link${eeat.citation_count !== 1 ? "s" : ""} (citations)` : "No external citations or references"}
              context={eeat.citation_count === 0 ? "Linking to credible external sources demonstrates thorough research and builds trust with both readers and Google. Aim for 2–5 high-quality citations." : !eeat.has_authoritative_citations ? "Citations exist but none link to .edu, .gov, or major publications. Adding one authoritative source significantly strengthens E-E-A-T." : "Links to authoritative sources — Google sees these as trust signals for your content."}
            />
            <RichCheckRow
              ok={eeat.has_trust_links}
              label={eeat.has_trust_links ? "Trust links present (Privacy / About / Contact)" : "Trust links not found in navigation"}
              context={!eeat.has_trust_links ? "Pages linking to Privacy Policy, About, and Contact establish site-level trust. Google's Quality Raters use these to evaluate whether the site is a real, accountable entity." : "Site has trust-building navigation links — important for site-wide E-E-A-T."}
            />
            <RichCheckRow
              ok={eeat.has_social_proof_schema}
              label={eeat.has_social_proof_schema ? "Review or AggregateRating schema found" : "No review or rating schema"}
              context={!eeat.has_social_proof_schema ? "Review schema can trigger star ratings in search results, dramatically increasing CTR. If you have reviews, add AggregateRating to your schema." : "Review schema present — eligible for star ratings in SERP."}
            />
            {eeat.missing_signals.length > 0 && (
              <div className="mt-1 rounded bg-muted/20 px-2 py-1.5">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">Signals to add</p>
                {eeat.missing_signals.slice(0, 4).map((s, i) => (
                  <p key={i} className="mt-0.5 text-[10px] text-foreground/70">• {s}</p>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* ── Competitive Intelligence ── */}
        <CollapsibleSection
          title={<span className="flex items-center gap-1.5"><Users className="size-3 text-chart-1" />Competitive Intelligence <ScoreBadge score={comp.score} label="" /></span>}
          defaultOpen={false}
        >
          <div className="flex flex-col gap-3">

            {/* Word count bar chart */}
            {wcData.length > 1 && (
              <div>
                <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">Word count vs. competitors</p>
                {comp.word_count_verdict && (
                  <p className="mb-2 text-[10px] leading-relaxed text-foreground/80">{comp.word_count_verdict}</p>
                )}
                <ResponsiveContainer width="100%" height={wcData.length * 28 + 8}>
                  <BarChart data={wcData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                      contentStyle={{ fontSize: 10, borderRadius: 4, border: "1px solid var(--border)", background: "var(--card)" }}
                      formatter={(v) => {
                        const words = typeof v === "number" ? v : Number(v ?? 0)
                        return [`${words.toLocaleString()} words`, ""]
                      }}
                    />
                    <Bar dataKey="words" radius={[0, 3, 3, 0]} barSize={10}>
                      {wcData.map((entry, i) => (
                        <Cell key={i} fill={entry.name === "You" ? "var(--chart-1)" : "var(--muted-foreground)"} fillOpacity={entry.name === "You" ? 0.9 : 0.4} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-1 text-[9px] text-muted-foreground">Studies show top-ranking pages average 1,447+ words for competitive queries. More depth ≠ more words — cover topics comprehensively.</p>
              </div>
            )}

            {/* SERP features */}
            {(comp.serp_features_present.length > 0 || comp.serp_features_missing.length > 0) && (
              <div>
                <Kicker prefix="//">serp features for this keyword</Kicker>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {comp.serp_features_present.map((f) => (
                    <Badge key={f} variant="secondary" className="text-[9px]">✓ {f.replace(/_/g, " ")}</Badge>
                  ))}
                  {comp.serp_features_missing.map((f) => (
                    <Badge key={f} variant="outline" className="text-[9px] border-chart-3/40 text-chart-3">{f.replace(/_/g, " ")}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Featured snippet */}
            {(comp.featured_snippet_holder || comp.featured_snippet_tip) && (
              <div className="rounded border border-chart-3/30 bg-chart-3/5 px-2.5 py-2">
                {comp.featured_snippet_holder ? (
                  <>
                    <p className="text-[10px] font-bold text-foreground">Featured snippet currently held by: <span className="text-chart-3">{comp.featured_snippet_holder}</span>{comp.featured_snippet_format ? ` (${comp.featured_snippet_format.replace(/_/g, " ")} format)` : ""}</p>
                    {comp.featured_snippet_tip && <p className="mt-1 text-[10px] text-foreground/80">{comp.featured_snippet_tip}</p>}
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-bold text-foreground">Featured snippet opportunity available</p>
                    {comp.featured_snippet_tip && <p className="mt-0.5 text-[10px] text-foreground/80">{comp.featured_snippet_tip}</p>}
                  </>
                )}
              </div>
            )}

            {/* Content gaps */}
            {comp.content_gaps?.length > 0 && (
              <div>
                <Kicker prefix="//">content gaps (what competitors cover that you don&apos;t)</Kicker>
                <div className="mt-1 flex flex-col gap-1">
                  {comp.content_gaps.map((gap, i) => (
                    <p key={i} className="flex items-start gap-1.5 text-[11px]">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0 text-chart-3" />
                      {gap}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Unique angle */}
            {comp.unique_angle_opportunity && (
              <div className="rounded border border-chart-2/30 bg-chart-2/5 px-2.5 py-2">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-chart-2">Untapped opportunity</p>
                <p className="mt-0.5 text-[10px] text-foreground/80">{comp.unique_angle_opportunity}</p>
              </div>
            )}

            {/* Top competitors */}
            {competitors.length > 0 && (
              <div>
                <Kicker prefix="//">competitors analyzed</Kicker>
                <div className="mt-1 flex flex-col gap-1.5">
                  {competitors.map((c, i) => (
                    <div key={i} className="rounded border border-border/50 px-2.5 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[10px] font-medium leading-tight">{c.title || c.url}</p>
                        <Badge variant="outline" className="shrink-0 text-[9px]">{c.word_count_estimate.toLocaleString()}w</Badge>
                      </div>
                      {c.main_h2s.length > 0 && (
                        <p className="mt-0.5 text-[9px] text-muted-foreground">Covers: {c.main_h2s.slice(0, 3).join(" · ")}</p>
                      )}
                      {c.schema_types.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-0.5">
                          {c.schema_types.map((s) => (
                            <Badge key={s} variant="secondary" className="text-[9px]">{s}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* ── 30/60/90-Day Action Plan ── */}
        {(result.action_plan_30d?.length > 0 || result.action_plan_60d?.length > 0) && (
          <CollapsibleSection title="30 / 60 / 90-Day Action Plan" defaultOpen={false}>
            <div className="flex flex-col gap-3">
              {result.action_plan_30d?.length > 0 && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-chart-2/15 text-[9px] font-bold text-chart-2">30d</div>
                    <div className="w-0.5 flex-1 bg-border/40" />
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="mb-1 text-[10px] font-bold text-chart-2">First 30 days — Foundation</p>
                    {result.action_plan_30d.map((a, i) => (
                      <p key={i} className="flex items-start gap-1 text-[10px] text-foreground/80">
                        <ArrowRight className="mt-0.5 size-2.5 shrink-0 text-chart-2" /> {a}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {result.action_plan_60d?.length > 0 && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-chart-3/15 text-[9px] font-bold text-chart-3">60d</div>
                    <div className="w-0.5 flex-1 bg-border/40" />
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="mb-1 text-[10px] font-bold text-chart-3">Days 30–60 — Growth</p>
                    {result.action_plan_60d.map((a, i) => (
                      <p key={i} className="flex items-start gap-1 text-[10px] text-foreground/80">
                        <ArrowRight className="mt-0.5 size-2.5 shrink-0 text-chart-3" /> {a}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {result.action_plan_90d?.length > 0 && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-chart-1/15 text-[9px] font-bold text-chart-1">90d</div>
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-[10px] font-bold text-chart-1">Days 60–90 — Authority</p>
                    {result.action_plan_90d.map((a, i) => (
                      <p key={i} className="flex items-start gap-1 text-[10px] text-foreground/80">
                        <ArrowRight className="mt-0.5 size-2.5 shrink-0 text-chart-1" /> {a}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* ── High / Medium priority if not shown above ── */}
        {result.high_priority?.length > 0 && (
          <CollapsibleSection title="High Priority Fixes" defaultOpen={false}>
            <div className="flex flex-col gap-1">
              {result.high_priority.map((item, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[11px]">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0 text-chart-3" />
                  {item}
                </p>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* ── Footer buttons ── */}
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="chat-utility"
            onClick={() =>
              onFollowUpAction?.("sage:page-seo-audit", { url: pageUrl, target_keyword: result.target_keyword })
            }
          >
            <Gauge className="size-3" /> Re-audit
          </Button>
          <CopyButton text={JSON.stringify(result, null, 2)} label="Copy full report" />
        </div>

      </AgentCard.Body>
    </AgentCard>
  )
}

// ─── Site Audit Card (batch of individual page audits) ───────────────────────

export function SiteAuditCard({
  result,
  onFollowUpAction,
}: {
  result: SageBatchAuditResult
  onFollowUpAction?: (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
}) {
  const pages = result.results ?? []
  const pageScore = (page: SagePageSeoAuditResult) =>
    page.overall_score ?? (page as { score?: number }).score ?? 0
  const avgScore = pages.length
    ? Math.round(pages.reduce((s, p) => s + pageScore(p), 0) / pages.length)
    : 0

  return (
    <div className="flex flex-col gap-3">
      {/* Summary header */}
      <AgentCard size="sm">
        <AgentCard.Header
          icon={<Globe />}
          title="Site Audit"
          badge={
            <Badge variant="outline" className="max-w-40 truncate text-[9px]">
              {result.domain}
            </Badge>
          }
          right={<ScoreRing score={avgScore} />}
        />
        <AgentCard.Body>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[9px]">{result.total_audited} pages audited</Badge>
            <Badge variant="outline" className={cn("text-[9px]", avgScore >= 80 ? "border-chart-2/40 text-chart-2" : avgScore >= 60 ? "border-chart-3/40 text-chart-3" : "border-destructive/40 text-destructive")}>
              avg {avgScore}/100
            </Badge>
          </div>
          {pages.length === 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">No pages were audited. Check that the URLs are accessible.</p>
          )}
        </AgentCard.Body>
      </AgentCard>

      {/* Individual page audit cards */}
      {pages.map((page, i) => (
        <div key={page.url ?? i} className="flex flex-col gap-0.5">
          <p className="px-1 text-[9px] uppercase tracking-widest text-muted-foreground">
            Page {i + 1} of {pages.length}
          </p>
          <PageSeoAuditCard result={page} onFollowUpAction={onFollowUpAction} />
        </div>
      ))}
    </div>
  )
}
