const API_URL = process.env.NEXT_PUBLIC_API_URL

export interface BriefingSection {
  agent: string
  title: string
  content: string
  timestamp: string
}

export interface Briefing {
  id: string
  date: string
  overview: string
  sections: BriefingSection[]
}

// ─── GET TODAY'S BRIEFING ─────────────────────────────────────────────────────
// POST /api/v1/rex/chat with content: "Generate today's executive briefing"
// TODO: build dedicated briefing route on Express
// Rex internally calls other agents via ask_agent tool
// Returns: the compiled briefing markdown
export async function getBriefing(organizationId: string): Promise<Briefing> {
  // TODO: connect backend
  // const res = await fetch(`${API_URL}/briefing?organizationId=${organizationId}`, { credentials: 'include' })
  // return res.json()

  // Mock briefing
  return {
    id: "mock-briefing-1",
    date: new Date().toISOString(),
    overview:
      "Your AI team worked overnight. Here's the executive summary: content pipeline is healthy, 3 new leads identified, revenue metrics are on track.",
    sections: [
      {
        agent: "maya",
        title: "Maya's Marketing Update",
        content:
          "Drafted 3 LinkedIn posts and 5 tweets for this week. Engagement on last week's content was 23% above average. Recommend posting Tuesday 9am for optimal reach.",
        timestamp: new Date().toISOString(),
      },
      {
        agent: "scout",
        title: "Scout's Lead Report",
        content:
          "Found 3 new ICP-matching leads: Acme Corp (score 87), BuildIt Inc (score 82), and Startly (score 79). Outreach drafts are ready.",
        timestamp: new Date().toISOString(),
      },
      {
        agent: "rex",
        title: "Rex's Revenue Snapshot",
        content:
          "MRR: $12,400 (▲ 8% MoM) — GREEN. Churn: 2.1% — AMBER. Runway: 14 months at current burn — GREEN. No critical flags.",
        timestamp: new Date().toISOString(),
      },
      {
        agent: "sage",
        title: "Sage's Strategy Brief",
        content:
          "Top keyword opportunity: 'AI workforce platform' — 2,400 searches/mo, low competition. Competitor Marblism published 4 new blog posts this week.",
        timestamp: new Date().toISOString(),
      },
      {
        agent: "lex",
        title: "Lex's Compliance Corner",
        content:
          "No urgent flags. Reminder: your standard NDA hasn't been reviewed since Q3 2024. Recommend scheduling a contract review.",
        timestamp: new Date().toISOString(),
      },
    ],
  }
}
