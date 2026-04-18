import type { BrandKit } from "@/lib/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL

// ─── LOAD BRAIN ───────────────────────────────────────────────────────────────
// GET /api/v1/brand-kit/:organizationId
// Returns null if the route is not yet available (404)
export async function getBrandKit(organizationId: string): Promise<BrandKit | null> {
  try {
    const res = await fetch(`${API_URL}/brand-kit/${organizationId}`, {
      credentials: "include",
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error("Failed to load brand kit")
    return res.json()
  } catch {
    return null
  }
}

// ─── SAVE BRAIN ───────────────────────────────────────────────────────────────
// PATCH /api/v1/brand-kit
// Returns { ok: true } on success, { ok: false, unavailable: true } on 404
export async function saveBrandKit(
  organizationId: string,
  data: Partial<BrandKit>
): Promise<{ ok: boolean; unavailable?: boolean }> {
  try {
    const res = await fetch(`${API_URL}/brand-kit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...data, organizationId }),
    })
    if (res.status === 404) return { ok: false, unavailable: true }
    if (!res.ok) throw new Error("Failed to save brand kit")
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

// ─── AUTO-FILL FROM URL ───────────────────────────────────────────────────────
// POST /api/v1/brand-kit/scrape
export async function scrapeBrandKit(
  url: string,
  organizationId: string
): Promise<Partial<BrandKit>> {
  const res = await fetch(`${API_URL}/brand-kit/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url, organizationId }),
  })
  if (!res.ok) throw new Error("Failed to scrape URL")
  return res.json()
}
