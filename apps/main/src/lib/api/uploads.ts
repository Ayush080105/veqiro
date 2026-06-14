// Direct-to-R2 upload helper.
//
// Flow:
//   1. presignUpload(kind, file)  →  { uploadUrl, key, publicUrl }
//   2. PUT file to uploadUrl       →  R2 has the bytes
//   3. caller hits a feature-specific finalize endpoint with { key, url }
//
// The presigned URL pins both Content-Type and Content-Length so the client
// can't deviate from what they declared at presign time.

const API_URL = process.env.NEXT_PUBLIC_API_URL

export type UploadKind = "logo" | "mascot" | "letterhead" | "lex-source" | "rex-dataset" | "inspiration" | "brand-image"

export interface PresignedUpload {
  uploadUrl: string
  key: string
  publicUrl: string
  expiresIn: number
}

type Result<T> = { ok: true; data: T } | { ok: false; message: string }

export async function presignUpload(
  kind: UploadKind,
  file: File,
): Promise<Result<PresignedUpload>> {
  try {
    const res = await fetch(`${API_URL}/uploads/presign`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        contentType: file.type,
        filename: file.name,
        size: file.size,
      }),
    })
    if (!res.ok) {
      let message = "Could not prepare upload."
      try {
        const j = (await res.json()) as { message?: string }
        if (j.message) message = j.message
      } catch {
        /* ignore */
      }
      return { ok: false, message }
    }
    const data = (await res.json()) as PresignedUpload
    return { ok: true, data }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error.",
    }
  }
}

// PUTs the raw file body to R2. Note we do NOT send credentials — this is a
// cross-origin request to R2, and the presigned URL is itself the auth.
export async function putToR2(
  uploadUrl: string,
  file: File,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    })
    if (!res.ok) {
      return { ok: false, message: `Storage upload failed (${res.status}).` }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error.",
    }
  }
}

// Convenience: presign + PUT in one call. Returns the R2 key + public URL.
export async function uploadToR2(
  kind: UploadKind,
  file: File,
): Promise<
  | { ok: true; key: string; publicUrl: string }
  | { ok: false; message: string }
> {
  const presigned = await presignUpload(kind, file)
  if (!presigned.ok) return presigned
  const put = await putToR2(presigned.data.uploadUrl, file)
  if (!put.ok) return put
  return { ok: true, key: presigned.data.key, publicUrl: presigned.data.publicUrl }
}
