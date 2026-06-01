import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { uploadToR2 } from "@/lib/api/uploads"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export interface BrandImage {
  id: string
  organizationId: string
  url: string
  key: string
  name: string
  createdAt: string
  updatedAt: string
}

export async function listBrandImages(): Promise<BrandImage[]> {
  const res = await fetch(`${API_URL}/brand-images`, { credentials: "include" })
  if (!res.ok) throw new Error("Failed to load brand images")
  return res.json() as Promise<BrandImage[]>
}

export type UploadBrandImageResult =
  | { ok: true; image: BrandImage }
  | { ok: false; message: string }

export async function uploadBrandImage(
  file: File,
  name: string,
): Promise<UploadBrandImageResult> {
  const uploaded = await uploadToR2("brand-image", file)
  if (!uploaded.ok) return { ok: false, message: uploaded.message }

  try {
    const res = await fetch(`${API_URL}/brand-images/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ key: uploaded.key, url: uploaded.publicUrl, name }),
    })
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string }
      return { ok: false, message: j.message ?? "Upload failed" }
    }
    const image = (await res.json()) as BrandImage
    return { ok: true, image }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Upload failed" }
  }
}

export async function updateBrandImage(
  id: string,
  data: { name: string },
): Promise<BrandImage> {
  const res = await fetch(`${API_URL}/brand-images/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update brand image")
  return res.json() as Promise<BrandImage>
}

export async function deleteBrandImage(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/brand-images/${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to delete brand image")
}

export const BRAND_IMAGES_KEY = ["brand-images"] as const

export function useBrandImages() {
  return useQuery({
    queryKey: BRAND_IMAGES_KEY,
    queryFn: listBrandImages,
  })
}

export function useDeleteBrandImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBrandImage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRAND_IMAGES_KEY })
    },
  })
}

export function useUpdateBrandImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateBrandImage(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRAND_IMAGES_KEY })
    },
  })
}
