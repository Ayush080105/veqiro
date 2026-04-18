import type { Lead, Competitor } from "@/lib/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL

// ─── LIST LEADS ───────────────────────────────────────────────────────────────
// GET /api/v1/leads?organizationId=xxx
// TODO: build on Express — sourced from Scout
export async function getLeads(organizationId: string): Promise<Lead[]> {
  const res = await fetch(
    `${API_URL}/leads?organizationId=${organizationId}`,
    { credentials: "include" }
  )
  if (!res.ok) throw new Error("Failed to load leads")
  return res.json()
}

// ─── LIST COMPETITORS ─────────────────────────────────────────────────────────
// GET /api/v1/scout/competitors?organizationId=xxx
// TODO: build on Express — sourced from Scout's competitor monitoring
export async function getCompetitors(organizationId: string): Promise<Competitor[]> {
  const res = await fetch(
    `${API_URL}/scout/competitors?organizationId=${organizationId}`,
    { credentials: "include" }
  )
  if (!res.ok) throw new Error("Failed to load competitors")
  return res.json()
}

// ─── GET MARKET TRENDS ────────────────────────────────────────────────────────
// GET /api/v1/sage/trends?organizationId=xxx
// TODO: build on Express — sourced from Sage's analysis
export async function getTrends(organizationId: string): Promise<{ topic: string; summary: string; date: string }[]> {
  const res = await fetch(
    `${API_URL}/sage/trends?organizationId=${organizationId}`,
    { credentials: "include" }
  )
  if (!res.ok) throw new Error("Failed to load trends")
  return res.json()
}
