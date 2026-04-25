import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { BrandKit } from "@/lib/types"
import { qk } from "@/lib/query-keys"

const API_URL = process.env.NEXT_PUBLIC_API_URL

// ─── Helpers ─────────────────────────────────────────────────────────────

const stripUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

// ─── LOAD BRAIN ───────────────────────────────────────────────────────────────
// GET /api/v1/brand-kit/:organizationId — returns null on 404 (kit not yet created).
export async function getBrandKit(organizationId: string): Promise<BrandKit | null> {
  try {
    const res = await fetch(`${API_URL}/brand-kit/${organizationId}`, {
      credentials: "include",
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error("Failed to load brand kit")
    return (await res.json()) as BrandKit
  } catch {
    return null
  }
}

// ─── SAVE BRAIN (auto-save) ───────────────────────────────────────────────────
// PATCH /api/v1/brand-kit — permissive validation. Returns the updated kit on
// success, null + flags on transport problems.
export type SaveResult =
  | { ok: true; kit: BrandKit }
  | { ok: false; unavailable?: boolean; message?: string }

export async function saveBrandKit(
  organizationId: string,
  data: Partial<BrandKit>,
): Promise<SaveResult> {
  try {
    const body = stripUndefined({ ...data, organizationId })
    const res = await fetch(`${API_URL}/brand-kit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    })
    if (res.status === 404) return { ok: false, unavailable: true }
    if (!res.ok) {
      const message = await res.text().catch(() => "Save failed")
      return { ok: false, message }
    }
    const kit = (await res.json()) as BrandKit
    return { ok: true, kit }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error",
    }
  }
}

// ─── FINALIZE BRAIN (strict — sets onboarded=true) ────────────────────────────
// POST /api/v1/brand-kit/finalize — strict validation, marks org onboarded.
export type FinalizeResult =
  | { ok: true; kit: BrandKit }
  | { ok: false; fieldErrors?: Record<string, string>; message?: string }

export async function finalizeBrandKit(
  organizationId: string,
  data: Partial<BrandKit>,
): Promise<FinalizeResult> {
  try {
    const res = await fetch(`${API_URL}/brand-kit/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...data, organizationId }),
    })
    if (res.ok) {
      const kit = (await res.json()) as BrandKit
      return { ok: true, kit }
    }
    // Try to surface zod field errors so the form can highlight them.
    try {
      const payload = (await res.json()) as {
        message?: string
        errors?: Array<{ path?: (string | number)[]; message?: string }>
      }
      const fieldErrors: Record<string, string> = {}
      for (const e of payload.errors ?? []) {
        const key = (e.path ?? []).filter((p) => typeof p === "string").join(".")
        if (key && e.message) fieldErrors[key] = e.message
      }
      return {
        ok: false,
        fieldErrors,
        message: payload.message ?? "Validation failed",
      }
    } catch {
      return { ok: false, message: `Save failed (${res.status})` }
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error",
    }
  }
}

// ─── ASSET UPLOAD ─────────────────────────────────────────────────────────────
// POST /api/v1/brand-kit/upload-asset — base64-JSON upload to R2.
export type UploadKind = "logo" | "mascot"

export type UploadAssetResult =
  | { ok: true; url: string; key: string; kind: UploadKind }
  | { ok: false; message: string }

export async function uploadBrandAsset(
  kind: UploadKind,
  file: File,
): Promise<UploadAssetResult> {
  try {
    const base64 = await fileToBase64(file)
    const res = await fetch(`${API_URL}/brand-kit/upload-asset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        kind,
        filename: file.name,
        contentType: file.type,
        base64,
      }),
    })
    if (!res.ok) {
      const message = await res.text().catch(() => "Upload failed")
      return { ok: false, message }
    }
    const data = (await res.json()) as {
      url: string
      key: string
      kind: UploadKind
    }
    return { ok: true, ...data }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Upload failed",
    }
  }
}

export async function removeBrandAsset(
  kind: UploadKind,
): Promise<{ ok: boolean; kit?: BrandKit; message?: string }> {
  try {
    const res = await fetch(`${API_URL}/brand-kit/asset/${kind}`, {
      method: "DELETE",
      credentials: "include",
    })
    if (!res.ok) {
      const message = await res.text().catch(() => "Remove failed")
      return { ok: false, message }
    }
    const kit = (await res.json()) as BrandKit
    return { ok: true, kit }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error",
    }
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string") {
        // Strip the "data:<mime>;base64," prefix.
        resolve(result.replace(/^data:[^;]+;base64,/, ""))
      } else {
        reject(new Error("Unexpected reader result"))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"))
    reader.readAsDataURL(file)
  })
}

// ─── AUTO-FILL FROM URL ───────────────────────────────────────────────────────
// POST /api/v1/brand-kit/scrape (optional, may not be implemented server-side yet)
export async function scrapeBrandKit(
  url: string,
  organizationId: string,
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

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useBrandKit(organizationId: string) {
  return useQuery({
    queryKey: qk.brandKit(organizationId),
    queryFn: () => getBrandKit(organizationId),
    enabled: !!organizationId,
  })
}

export function useSaveBrandKit(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<BrandKit>) => saveBrandKit(organizationId, data),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData(qk.brandKit(organizationId), result.kit)
      }
    },
  })
}

export function useScrapeBrandKit(organizationId: string) {
  return useMutation({
    mutationFn: (url: string) => scrapeBrandKit(url, organizationId),
  })
}
