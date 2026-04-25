import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { apiFetch, ApiError, AgentNotAvailableError } from "@/lib/api/client"
import { qk } from "@/lib/query-keys"
import type { LexSource } from "@/lib/types/agents"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export async function uploadLexDocument(input: {
  file: File
  documentName: string
  documentType: string
}): Promise<LexSource> {
  const fd = new FormData()
  fd.append("file", input.file)
  fd.append("documentName", input.documentName)
  fd.append("documentType", input.documentType)

  const res = await fetch(`${API_URL}/agents/lex/sources/upload`, {
    method: "POST",
    credentials: "include",
    body: fd,
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
