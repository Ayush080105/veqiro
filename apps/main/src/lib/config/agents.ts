import type { AgentConfig } from "@/lib/types"

export const AGENTS: AgentConfig[] = [
  {
    id: "maya",
    name: "Maya",
    role: "Marketing & Content Creation",
    llm: "GPT-4o-mini",
    personality: "Creative, energetic, trend-aware",
    description:
      "Maya crafts compelling content across every platform — social posts, blogs, ad copy — and generates on-brand images automatically.",
    specialties: ["Social Media", "Content Strategy", "Copywriting", "Image Generation"],
    color: "chart-1",
    initials: "MA",
  },
  {
    id: "rex",
    name: "Rex",
    role: "Financial Analytics & Revenue",
    llm: "GPT-4o-mini",
    personality: "Bold, persuasive, data-driven",
    description:
      "Rex tracks your financial health with RED/AMBER/GREEN flags on MRR, churn, runway, and more. No surprises, just clarity.",
    specialties: ["MRR/ARR Tracking", "Burn Rate", "Revenue Forecasting", "Financial Health"],
    color: "chart-2",
    initials: "RX",
  },
  {
    id: "scout",
    name: "Scout",
    role: "Market Research & Competitors",
    llm: "Gemini 2.0-Flash",
    personality: "Curious, persistent, always hunting",
    description:
      "Scout monitors competitors, finds market trends, and surfaces leads — hunting 24/7 so you don't have to.",
    specialties: ["Competitor Intel", "Lead Generation", "Market Trends", "Company Research"],
    color: "chart-3",
    initials: "SC",
  },
  {
    id: "sage",
    name: "Sage",
    role: "SEO & Content Strategy",
    llm: "Gemini 2.0-Flash",
    personality: "Thoughtful, analytical, big-picture",
    description:
      "Sage builds your SEO foundation — keyword research, content audits, full blog drafts, and strategic content briefs.",
    specialties: ["Keyword Research", "Content Audits", "Blog Generation", "SEO Strategy"],
    color: "chart-4",
    initials: "SG",
  },
  {
    id: "lex",
    name: "Lex",
    role: "Legal & Compliance",
    llm: "Gemini 2.0-Flash",
    personality: "Precise, cautious, formal but friendly",
    description:
      "Lex reviews contracts, drafts documents, and explains legal concepts in plain English — always with proper disclaimers.",
    specialties: ["Contract Review", "Document Drafting", "Legal Explanations", "Compliance"],
    color: "chart-5",
    initials: "LX",
  },
  {
    id: "vega",
    name: "Vega",
    role: "Executive Assistant",
    llm: "GPT-4o-mini",
    personality: "Organised, proactive, detail-oriented",
    description:
      "Vega manages your inbox, schedules meetings, and delivers executive briefings — your always-on chief of staff.",
    specialties: ["Email Triage", "Calendar Management", "Executive Briefings", "Task Management"],
    color: "primary",
    initials: "VG",
  },
]

export function getAgent(id: string): AgentConfig | undefined {
  return AGENTS.find((a) => a.id === id)
}
