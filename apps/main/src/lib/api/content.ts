import type { ContentItem, ContentPlatform } from "@/lib/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL

// ─── LIST CONTENT ─────────────────────────────────────────────────────────────
// GET /api/v1/content?organizationId=xxx
// TODO: build on Express
export async function getContent(organizationId: string): Promise<ContentItem[]> {
  const res = await fetch(
    `${API_URL}/content?organizationId=${organizationId}`,
    { credentials: "include" }
  )
  if (!res.ok) throw new Error("Failed to load content")
  return res.json()
}

// ─── GENERATE CONTENT ─────────────────────────────────────────────────────────
// POST /api/v1/content/generate
// Body: { platform, topic, tone, organizationId }
// TODO: build on Express — routes through Maya agent
export async function generateContent(
  organizationId: string,
  platform: ContentPlatform,
  topic: string,
  tone: string
): Promise<ContentItem> {
  const res = await fetch(`${API_URL}/content/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ organizationId, platform, topic, tone }),
  })
  if (!res.ok) throw new Error("Failed to generate content")
  return res.json()
}

// ─── UPDATE CONTENT ───────────────────────────────────────────────────────────
// PATCH /api/v1/content/:id
// Body: { status?, scheduledAt? }
export async function updateContent(
  id: string,
  data: Partial<Pick<ContentItem, "status" | "scheduledAt">>
): Promise<ContentItem> {
  const res = await fetch(`${API_URL}/content/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update content")
  return res.json()
}
