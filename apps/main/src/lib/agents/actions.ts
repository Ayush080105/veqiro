import type { AgentSlug } from "@/lib/types"
import type { AgentActionId } from "@/lib/types/agents"

export interface AgentActionMeta {
  id: AgentActionId
  agent: AgentSlug
  /** Trailing segment appended to /api/v1/{agent}/ */
  endpoint: string
  label: string
  description: string
  /** Lucide icon name (resolved in PlusMenu) */
  icon: string
  /** Shown as an example prompt / hint */
  example?: string
}

export const AGENT_ACTIONS: Record<AgentSlug, AgentActionMeta[]> = {
  sage: [
    {
      id: "sage:keyword-research",
      agent: "sage",
      endpoint: "keyword-research",
      label: "Keyword research",
      description: "Discover SEO keywords and intent clusters around a seed topic.",
      icon: "Search",
      example: "AI productivity tools for founders",
    },
    {
      id: "sage:generate-blog",
      agent: "sage",
      endpoint: "generate-blog",
      label: "Generate blog post",
      description: "Draft a full SEO-optimized blog post with meta tags and schema.",
      icon: "FileText",
    },
    {
      id: "sage:analyze-content",
      agent: "sage",
      endpoint: "analyze-content",
      label: "Audit content",
      description: "Score existing content and surface SEO improvements.",
      icon: "Gauge",
    },
    {
      id: "sage:content-brief",
      agent: "sage",
      endpoint: "content-brief",
      label: "Content brief",
      description: "Produce a strategic content brief with competitor gap analysis.",
      icon: "ClipboardList",
    },
  ],
  maya: [
    {
      id: "maya:generate-ideas",
      agent: "maya",
      endpoint: "generate-ideas",
      label: "Generate post ideas",
      description: "Platform-native content ideas with hooks and predicted engagement.",
      icon: "Sparkles",
    },
    {
      id: "maya:draft-content",
      agent: "maya",
      endpoint: "draft-content",
      label: "Draft a post",
      description: "Full ready-to-publish social post with optional AI image.",
      icon: "PenLine",
    },
    {
      id: "maya:generate-variants",
      agent: "maya",
      endpoint: "generate-variants",
      label: "Adapt to other platforms",
      description: "Rewrite a post for different platforms while preserving voice.",
      icon: "Shuffle",
    },
    {
      id: "maya:revise",
      agent: "maya",
      endpoint: "revise",
      label: "Revise a post",
      description: "Refine an existing post based on feedback.",
      icon: "Wand2",
    },
    {
      id: "maya:regenerate-image",
      agent: "maya",
      endpoint: "regenerate-image",
      label: "Regenerate image",
      description: "Redraw an existing post image with a new prompt.",
      icon: "Image",
    },
    {
      id: "maya:regenerate-content",
      agent: "maya",
      endpoint: "regenerate-content",
      label: "Rewrite caption",
      description: "Rework caption copy with a new prompt.",
      icon: "RefreshCw",
    },
  ],
  scout: [
    {
      id: "scout:research-topic",
      agent: "scout",
      endpoint: "research-topic",
      label: "Research a topic",
      description: "Deep research with web scraping and synthesis.",
      icon: "Binoculars",
    },
    {
      id: "scout:research-company",
      agent: "scout",
      endpoint: "research-company",
      label: "Research a company",
      description: "Build a profile — features, pricing, SWOT, recent news.",
      icon: "Building2",
    },
    {
      id: "scout:scan-competitors",
      agent: "scout",
      endpoint: "scan-competitors",
      label: "Scan competitors",
      description: "Detect changes across a list of competitor websites.",
      icon: "Radar",
    },
    {
      id: "scout:trending-topics",
      agent: "scout",
      endpoint: "trending-topics",
      label: "Trending topics",
      description: "Discover rising topics in an industry with content angles.",
      icon: "TrendingUp",
    },
  ],
  rex: [
    {
      id: "rex:analyze-metrics",
      agent: "rex",
      endpoint: "analyze-metrics",
      label: "Analyze metrics",
      description: "Trend, anomaly, and health analysis across your KPIs.",
      icon: "LineChart",
    },
    {
      id: "rex:forecast",
      agent: "rex",
      endpoint: "forecast",
      label: "Forecast a metric",
      description: "Project a metric forward with confidence bands.",
      icon: "TrendingUp",
    },
    {
      id: "rex:financial-analysis",
      agent: "rex",
      endpoint: "financial-analysis",
      label: "Financial analysis",
      description: "MRR, ARR, churn, burn, runway and recommendations.",
      icon: "DollarSign",
    },
    {
      id: "rex:compile-briefing",
      agent: "rex",
      endpoint: "compile-briefing",
      label: "Executive briefing",
      description: "Stitch metrics + agent summaries into one briefing.",
      icon: "Newspaper",
    },
  ],
  lex: [
    {
      id: "lex:ingest-document",
      agent: "lex",
      endpoint: "ingest-document",
      label: "Upload a document",
      description: "Ingest a PDF for retrieval-powered analysis.",
      icon: "Upload",
    },
    {
      id: "lex:analyze-contract",
      agent: "lex",
      endpoint: "analyze-contract",
      label: "Analyze a contract",
      description: "Risk analysis, unusual clauses, missing protections.",
      icon: "ShieldAlert",
    },
    {
      id: "lex:draft-document",
      agent: "lex",
      endpoint: "draft-document",
      label: "Draft a document",
      description: "Generate a legal template — NDA, SaaS MSA, offer letter…",
      icon: "FileSignature",
    },
    {
      id: "lex:explain",
      agent: "lex",
      endpoint: "explain",
      label: "Explain legal text",
      description: "Plain-English explanation with key terms glossary.",
      icon: "BookOpen",
    },
    {
      id: "lex:legal-research",
      agent: "lex",
      endpoint: "legal-research",
      label: "Research a legal question",
      description: "Applicable laws, cases, and practical guidance for a jurisdiction.",
      icon: "Scale",
    },
    {
      id: "lex:compliance-check",
      agent: "lex",
      endpoint: "compliance-check",
      label: "Compliance check",
      description: "Evaluate practice or doc against GDPR, CCPA, SOC2, HIPAA.",
      icon: "ShieldCheck",
    },
  ],
  vega: [
    {
      id: "vega:process-inbox",
      agent: "vega",
      endpoint: "process-inbox",
      label: "Triage inbox",
      description: "Prioritize, label, and optionally draft replies.",
      icon: "Inbox",
    },
    {
      id: "vega:draft-reply",
      agent: "vega",
      endpoint: "draft-reply",
      label: "Draft a reply",
      description: "Reply in your voice to a specific email.",
      icon: "Reply",
    },
    {
      id: "vega:calendar-summary",
      agent: "vega",
      endpoint: "calendar-summary",
      label: "Calendar summary",
      description: "Agenda, conflicts, and free slots for the next week.",
      icon: "CalendarDays",
    },
    {
      id: "vega:create-event",
      agent: "vega",
      endpoint: "create-event",
      label: "Schedule an event",
      description: "Parse a plain-English event and create it on your calendar.",
      icon: "CalendarPlus",
    },
    {
      id: "vega:executive-briefing",
      agent: "vega",
      endpoint: "executive-briefing",
      label: "Executive briefing",
      description: "Daily exec briefing — urgent actions, schedule, focus.",
      icon: "Sun",
    },
  ],
}

export function findAction(id: AgentActionId): AgentActionMeta | undefined {
  for (const list of Object.values(AGENT_ACTIONS)) {
    const a = list.find((x) => x.id === id)
    if (a) return a
  }
  return undefined
}
