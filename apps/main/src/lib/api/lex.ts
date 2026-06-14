import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { apiFetch, ApiError, AgentNotAvailableError } from "@/lib/api/client"
import { qk } from "@/lib/query-keys"
import { uploadToR2 } from "@/lib/api/uploads"
import type { LexSource } from "@/lib/types/agents"

const API_URL = process.env.NEXT_PUBLIC_API_URL

// Direct-to-R2: presign → PUT the PDF straight to R2 → finalize on server.
export async function uploadLexDocument(input: {
  file: File
  documentName: string
  documentType: string
}): Promise<LexSource> {
  const uploaded = await uploadToR2("lex-source", input.file)
  if (!uploaded.ok) {
    throw new ApiError(0, uploaded.message)
  }

  const res = await fetch(`${API_URL}/agents/lex/sources/finalize`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: uploaded.key,
      url: uploaded.publicUrl,
      documentName: input.documentName,
      documentType: input.documentType,
    }),
  })
  if (res.status === 404) throw new AgentNotAvailableError("lex")
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = await res.json()
      detail = j.message ?? j.detail ?? detail
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail)
  }
  return (await res.json()) as LexSource
}

export async function listLexSources(): Promise<LexSource[]> {
  try {
    return await apiFetch<LexSource[]>("/agents/lex/sources", {
      agentSlugForNotFound: "lex",
    })
  } catch (err) {
    if (err instanceof AgentNotAvailableError) return []
    throw err
  }
}

export async function deleteLexSource(id: string): Promise<{ deleted: true }> {
  return apiFetch<{ deleted: true }>(`/agents/lex/sources/${id}`, {
    method: "DELETE",
    agentSlugForNotFound: "lex",
  })
}

export function useLexSources() {
  return useQuery({
    queryKey: qk.lexSources(),
    queryFn: () => listLexSources(),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useUploadLexSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadLexDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.lexSources() })
    },
  })
}

export function useDeleteLexSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteLexSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.lexSources() })
    },
  })
}

export async function stampLexLetterhead(input: {
  fileUrl: string
  filename: string
  format: "docx" | "pdf"
}): Promise<{ file_b64: string; mime_type: string; filename: string }> {
  return apiFetch("/agents/lex/stamp-letterhead", {
    method: "POST",
    body: {
      fileUrl: input.fileUrl,
      filename: input.filename,
      format: input.format,
    },
  })
}

export async function exportLexDocument(input: {
  document: string
  format: "docx" | "pdf"
  documentType?: string
  includeLetterhead?: boolean
}): Promise<{ file_b64: string; mime_type: string; filename: string }> {
  return apiFetch("/agents/lex/export-document", {
    method: "POST",
    body: {
      document: input.document,
      format: input.format,
      documentType: input.documentType ?? "Legal Document",
      includeLetterhead: input.includeLetterhead ?? false,
    },
  })
}
