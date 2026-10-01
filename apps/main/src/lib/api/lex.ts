import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { apiFetch, ApiError, AgentNotAvailableError } from "@/lib/api/client"
import { qk } from "@/lib/query-keys"
import { uploadToR2 } from "@/lib/api/uploads"
import type {
  LexBrief,
  LexDraftReplyResult,
  LexObligation,
  LexPreference,
  LexSource,
  LexSourceDetail,
  LexVersionComparison,
  LexWatch,
} from "@/lib/types/agents"

const API_URL = process.env.NEXT_PUBLIC_API_URL

// Direct-to-R2: presign → PUT the PDF straight to R2 → finalize on server.
export async function uploadLexDocument(input: {
  file: File
  documentName: string
  documentType: string
  previousVersionId?: string | null
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
      previousVersionId: input.previousVersionId || null,
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

export function useLexSources(enabled = true) {
  return useQuery({
    queryKey: qk.lexSources(),
    queryFn: () => listLexSources(),
    staleTime: 30_000,
    enabled,
    placeholderData: (prev) => prev,
  })
}

/** Every Lex read model that a review, upload or date change can affect. */
export function invalidateLexMemory(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["lex"] })
}

export function useLexSourceSearch(q: string) {
  const term = q.trim()
  return useQuery({
    queryKey: qk.lexSourceSearch(term),
    queryFn: () => apiFetch<LexSource[]>(`/agents/lex/sources?q=${encodeURIComponent(term)}`, { agentSlugForNotFound: "lex" }),
    enabled: term.length >= 2,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useLexSourceDetail(id: string | null) {
  return useQuery({
    queryKey: qk.lexSource(id ?? ""),
    queryFn: () => apiFetch<LexSourceDetail>(`/agents/lex/sources/${id}`, { agentSlugForNotFound: "lex" }),
    enabled: Boolean(id),
  })
}

export function useLexWatch(enabled = true) {
  return useQuery({
    queryKey: qk.lexWatch(),
    queryFn: () => apiFetch<LexWatch>("/agents/lex/watch", { agentSlugForNotFound: "lex" }),
    enabled,
    staleTime: 60_000,
  })
}

export function useLexBrief(enabled = true) {
  return useQuery({
    queryKey: qk.lexBrief(),
    queryFn: () => apiFetch<LexBrief>("/agents/lex/brief", { agentSlugForNotFound: "lex" }),
    enabled,
    staleTime: 60_000,
  })
}

export function useLexPreferences(enabled = true) {
  return useQuery({
    queryKey: qk.lexPreferences(),
    queryFn: () => apiFetch<LexPreference[]>("/agents/lex/preferences", { agentSlugForNotFound: "lex" }),
    enabled,
  })
}

export function useSaveLexPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    // Sent as a JSON-encoded map under a camel-safe key: preference keys are snake_case and the
    // server's body camelizer would otherwise rename them.
    mutationFn: (values: Record<string, string>) =>
      apiFetch<LexPreference[]>("/agents/lex/preferences", {
        method: "PATCH",
        body: { values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k.replace(/_/g, "-"), v])) },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.lexPreferences(), data)
    },
  })
}

export function useLexSettings(enabled = true) {
  return useQuery({
    queryKey: qk.lexSettings(),
    queryFn: () => apiFetch<{ weeklyBrief: boolean; lastBriefAt: string | null }>("/agents/lex/settings", { agentSlugForNotFound: "lex" }),
    enabled,
  })
}

export function useSaveLexSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { weeklyBrief: boolean }) =>
      apiFetch<{ weeklyBrief: boolean; lastBriefAt: string | null }>("/agents/lex/settings", { method: "PATCH", body: input }),
    onSuccess: (data) => queryClient.setQueryData(qk.lexSettings(), data),
  })
}

export function useLexVersionCandidates(name: string) {
  const term = name.trim()
  return useQuery({
    queryKey: qk.lexVersionCandidates(term),
    queryFn: () =>
      apiFetch<Array<{ id: string; name: string; version: number; createdAt: string }>>(
        `/agents/lex/sources/version-candidates?name=${encodeURIComponent(term)}`,
        { agentSlugForNotFound: "lex" },
      ),
    enabled: term.length >= 3,
    staleTime: 60_000,
  })
}

export async function addLexReminders(sourceRowId: string, input: { obligationIds: string[]; startDate?: string | null }) {
  return apiFetch<LexObligation[]>(`/agents/lex/sources/${sourceRowId}/reminders`, { method: "POST", body: input })
}

export async function updateLexObligation(id: string, input: { status?: LexObligation["status"]; reminderOn?: boolean }) {
  return apiFetch<LexObligation>(`/agents/lex/obligations/${id}`, { method: "PATCH", body: input })
}

export async function compareLexVersion(sourceRowId: string, force = false) {
  return apiFetch<LexVersionComparison>(`/agents/lex/sources/${sourceRowId}/compare`, { method: "POST", body: { force } })
}

export async function draftLexReply(input: { analysis: unknown; sourceRowId?: string | null; sender?: string; tone?: string }) {
  return apiFetch<LexDraftReplyResult>("/agents/lex/draft-reply", {
    method: "POST",
    body: {
      analysisJson: JSON.stringify(input.analysis),
      sourceRowId: input.sourceRowId ?? null,
      sender: input.sender ?? "",
      tone: input.tone ?? "firm but friendly",
    },
  })
}

export async function recordLexActivity(input: {
  action: "exported_review" | "copied_reply" | "shared_with_counsel" | "opened_version_changes"
  sourceRowId?: string | null
  detail?: string
}) {
  try {
    await apiFetch("/agents/lex/activity", { method: "POST", body: input })
  } catch {
    // The audit trail must never block what the user was doing.
  }
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
