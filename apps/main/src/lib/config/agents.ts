import type { AgentConfig, AgentSlug } from "@/lib/types"

/**
 * Canonical agent config. Single source of truth for:
 * - assistants runtime (llm, personality, specialties, description)
 * - landing-style crew cards (color, ink, tag, quote, stats, skills)
 * - chat empty-state (quickPrompts)
 */
export const AGENTS: AgentConfig[] = [
  {
    id: "maya",
    name: "Maya",
    role: "Content & Marketing",
    llm: "GPT-4o-mini",
    personality: "Creative, energetic, trend-aware",
    description:
      "Maya crafts compelling content across every platform — social posts, blogs, ad copy — and generates on-brand images automatically.",
    specialties: ["Social Media", "Content Strategy", "Copywriting", "Image Generation"],
    color: "var(--vq-red)",
    ink: "#7A1717",
    initials: "MA",
    tag: "Writes like a human, ships like a machine",
    quote:
      "Drafted 3 headlines, 1 is safe, 1 is spicy, 1 is cursed. I vote spicy. You pick.",
    stats: [
      { k: "Posts published", v: "210K" },
      { k: "Avg CTR lift", v: "+34%" },
      { k: "Brand voices", v: "900+" },
    ],
    skills: ["Blog posts", "Ad copy", "Brand voice", "Campaign plans"],
    quickPrompts: ["Draft a launch tweet", "Write a blog post outline", "Rewrite my LinkedIn bio"],
  },
  {
    id: "rex",
    name: "Rex",
    role: "Data Analyst & Finance",
    llm: "GPT-4o-mini",
    personality: "Bold, persuasive, data-driven",
    description:
      "Rex tracks your financial health with RED/AMBER/GREEN flags on MRR, churn, runway, and more. No surprises, just clarity.",
    specialties: ["MRR/ARR Tracking", "Burn Rate", "Revenue Forecasting", "Financial Health"],
    color: "var(--vq-green)",
    ink: "#0E5C3F",
    initials: "RX",
    tag: "Makes spreadsheets sing",
    quote:
      "Revenue is up 12% MoM but your CAC is doing something weird. Want me to show you the weird thing?",
    stats: [
      { k: "Rows crunched", v: "8.9B" },
      { k: "Models built", v: "62K" },
      { k: "Anomalies flagged", v: "120K" },
    ],
    skills: ["Financial models", "Dashboards", "Forecasts", "Anomaly detection"],
    quickPrompts: ["Pull last month's MRR", "Build a CAC dashboard", "Spot anomalies"],
  },
  {
    id: "scout",
    name: "Scout",
    role: "Research & Strategist",
    llm: "Gemini 2.0-Flash",
    personality: "Curious, persistent, always hunting",
    description:
      "Scout monitors competitors, finds market trends, and surfaces leads — hunting 24/7 so you don't have to.",
    specialties: ["Competitor Intel", "Lead Generation", "Market Trends", "Company Research"],
    color: "var(--vq-yellow)",
    ink: "#7A5A00",
    initials: "SC",
    tag: "Finds the signal, skips the noise",
    quote:
      "Pulled 23 comps, killed 18 that were noise. Here's the 5 that actually move the needle — and one weird one.",
    stats: [
      { k: "Reports written", v: "89K" },
      { k: "Sources cited", v: "4.1M" },
      { k: "Hours saved/week", v: "38" },
    ],
    skills: ["Market scans", "Competitor teardowns", "Memo writing", "Trend spotting"],
    quickPrompts: ["Run a competitor teardown", "What's trending this week?", "Pull last week's news"],
  },
  {
    id: "sage",
    name: "Sage",
    role: "The SEO Specialist",
    llm: "Gemini 2.0-Flash",
    personality: "Thoughtful, analytical, big-picture",
    description:
      "Sage builds your SEO foundation — keyword research, content audits, full blog drafts, and strategic content briefs.",
    specialties: ["Keyword Research", "Content Audits", "Blog Generation", "SEO Strategy"],
    color: "var(--vq-pink)",
    ink: "#8E2A6A",
    initials: "SG",
    tag: "Ranks pages in her sleep",
    quote:
      "We're ranking #4 for \"best crm for tiny teams\". Give me a week and a coffee — we'll take #1.",
    stats: [
      { k: "Keywords ranked", v: "2.3M" },
      { k: "Avg position lift", v: "+11" },
      { k: "Traffic unlocked", v: "410M" },
    ],
    skills: ["Keyword research", "On-page SEO", "Backlink ops", "SERP tracking"],
    quickPrompts: ["Audit my top 10 pages", "Find long-tail keywords", "Review meta tags"],
  },
  {
    id: "lex",
    name: "Lex",
    role: "The Legal Assistant",
    llm: "Gemini 2.0-Flash",
    personality: "Precise, cautious, formal but friendly",
    description:
      "Lex reviews contracts, drafts documents, and explains legal concepts in plain English with direct, unhedged analysis.",
    specialties: ["Contract Review", "Document Drafting", "Legal Explanations", "Compliance"],
    color: "var(--vq-violet)",
    ink: "#2A2A7A",
    initials: "LX",
    tag: "Reads the fine print so you don't",
    quote:
      "Clause 7.3 is a trap. Redlined it. Also Clause 4 is fine but written by a poet — I cleaned it up.",
    stats: [
      { k: "Contracts reviewed", v: "180K" },
      { k: "Red flags caught", v: "41K" },
      { k: "Avg review time", v: "4 min" },
    ],
    skills: ["NDA review", "Contract drafting", "Clause flagging", "Policy audits"],
    quickPrompts: ["Review this NDA", "Draft a mutual NDA", "Flag contract risks"],
  },
  {
    id: "vega",
    name: "Vega",
    role: "The Executive Assistant",
    llm: "GPT-4o-mini",
    personality: "Organised, proactive, detail-oriented",
    description:
      "Vega helps you plan the day, prioritize, and think through decisions — your always-on chief of staff. Connect Gmail or Calendar any time to bring in your real inbox and schedule.",
    specialties: ["Prioritization", "Planning", "Decision Support", "Task Management"],
    color: "var(--vq-blue)",
    ink: "#0E5C74",
    initials: "VG",
    tag: "Your right hand, 24/7",
    quote:
      "Given the three deadlines this week, I'd tackle the investor update first — everything else can slip a day.",
    stats: [
      { k: "Conversations", v: "1.2M+" },
      { k: "Decisions supported", v: "340K" },
      { k: "Avg reply time", v: "47s" },
    ],
    skills: ["Prioritization", "Planning", "Task tracking", "Follow-ups"],
    quickPrompts: ["Help me plan tomorrow", "What should I prioritize this week?", "Draft a follow-up plan"],
  },
]

export function getAgent(id: string): AgentConfig | undefined {
  return AGENTS.find((a) => a.id === id)
}

export function getAgentBySlug(slug: AgentSlug): AgentConfig {
  const agent = AGENTS.find((a) => a.id === slug)
  if (!agent) throw new Error(`Unknown agent slug: ${slug}`)
  return agent
}
