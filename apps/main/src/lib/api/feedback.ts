import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"

// Types
export type FeedbackCategory = "FEATURE_REQUEST" | "BUG_REPORT" | "INTEGRATION" | "NEW_AGENT" | "UX_IMPROVEMENT" | "GENERAL"
export type FeedbackStatus = "NEW" | "UNDER_REVIEW" | "PLANNED" | "IN_PROGRESS" | "LAUNCHED" | "DECLINED"

export interface FeedbackPost {
  id: string
  title: string
  description: string
  category: FeedbackCategory
  agentSlug: string | null
  status: FeedbackStatus
  voteCount: number
  adminReply: string | null
  roadmapEta: string | null
  isMerged: boolean
  hasVoted: boolean
  createdAt: string
  createdBy: { id: string; name: string }
  _count: { comments: number }
}

export interface FeedbackComment {
  id: string
  content: string
  isAdminReply: boolean
  createdAt: string
  user: { id: string; name: string }
}

export interface UpcomingAgent {
  id: string
  name: string
  tagline: string
  description: string | null
  emoji: string | null
  color: string | null
  voteCount: number
  hasVoted: boolean
}

export type FeedbackFilters = {
  status?: FeedbackStatus
  category?: FeedbackCategory
  agentSlug?: string
  sort?: "votes" | "newest" | "trending"
  search?: string
}

// List feedback
export function useFeedbackList(filters: FeedbackFilters = {}) {
  const params = new URLSearchParams()
  if (filters.status) params.set("status", filters.status)
  if (filters.category) params.set("category", filters.category)
  if (filters.agentSlug) params.set("agentSlug", filters.agentSlug)
  if (filters.sort) params.set("sort", filters.sort)
  if (filters.search) params.set("search", filters.search)
  const qs = params.toString()

  return useQuery({
    queryKey: ["feedback", filters],
    queryFn: () => apiFetch<FeedbackPost[]>(`/feedback${qs ? `?${qs}` : ""}`),
  })
}

// Get single feedback post with comments
export function useFeedbackDetail(id: string) {
  return useQuery({
    queryKey: ["feedback", id],
    queryFn: () => apiFetch<FeedbackPost & { comments: FeedbackComment[]; userVoteIds: string[] }>(`/feedback/${id}`),
    enabled: !!id,
  })
}

// Similar posts (for submit form duplicate detection)
export function useSimilarPosts(title: string) {
  return useQuery({
    queryKey: ["feedback", "similar", title],
    queryFn: () => apiFetch<Pick<FeedbackPost, "id" | "title" | "status" | "voteCount" | "category">[]>(`/feedback/similar?title=${encodeURIComponent(title)}`),
    enabled: title.length > 3,
    staleTime: 5_000,
  })
}

// Toggle vote on a feedback post
export function useToggleVote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (feedbackId: string) =>
      apiFetch<{ voted: boolean; voteCount: number }>(`/feedback/${feedbackId}/vote`, { method: "POST" }),
    onMutate: async (feedbackId: string) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: ["feedback"] })

      // Snapshot previous values for rollback
      const previousList = qc.getQueriesData<FeedbackPost[]>({ queryKey: ["feedback"] })
      const previousDetail = qc.getQueryData<FeedbackPost & { comments: FeedbackComment[]; userVoteIds: string[] }>(["feedback", feedbackId])

      // Optimistically update every list cache entry that contains this post
      qc.setQueriesData<FeedbackPost[]>({ queryKey: ["feedback"] }, (old) => {
        if (!Array.isArray(old)) return old
        return old.map((post) => {
          if (post.id !== feedbackId) return post
          const toggled = !post.hasVoted
          return { ...post, hasVoted: toggled, voteCount: post.voteCount + (toggled ? 1 : -1) }
        })
      })

      // Optimistically update the detail cache if loaded
      if (previousDetail) {
        const toggled = !previousDetail.hasVoted
        qc.setQueryData(["feedback", feedbackId], {
          ...previousDetail,
          hasVoted: toggled,
          voteCount: previousDetail.voteCount + (toggled ? 1 : -1),
        })
      }

      return { previousList, previousDetail }
    },
    onError: (_err, feedbackId, context) => {
      // Roll back on error
      if (context?.previousList) {
        for (const [queryKey, data] of context.previousList) {
          qc.setQueryData(queryKey, data)
        }
      }
      if (context?.previousDetail) {
        qc.setQueryData(["feedback", feedbackId], context.previousDetail)
      }
    },
    onSuccess: (result, feedbackId) => {
      // Reconcile with server truth on the detail cache
      qc.setQueryData<FeedbackPost & { comments: FeedbackComment[]; userVoteIds: string[] }>(
        ["feedback", feedbackId],
        (old) => {
          if (!old) return old
          return { ...old, hasVoted: result.voted, voteCount: result.voteCount }
        }
      )
      // Reconcile list caches with server truth
      qc.setQueriesData<FeedbackPost[]>({ queryKey: ["feedback"] }, (old) => {
        if (!Array.isArray(old)) return old
        return old.map((post) => {
          if (post.id !== feedbackId) return post
          return { ...post, hasVoted: result.voted, voteCount: result.voteCount }
        })
      })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["feedback"] })
    },
  })
}

// Add comment
export function useAddComment(feedbackId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      apiFetch<FeedbackComment>(`/feedback/${feedbackId}/comments`, { method: "POST", body: { content } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback", feedbackId] })
    },
  })
}

// Create feedback post
export function useCreateFeedback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; description: string; category: FeedbackCategory; agentSlug?: string | null }) =>
      apiFetch<FeedbackPost>("/feedback", { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback"] })
    },
  })
}

// Upcoming agents
export function useUpcomingAgents() {
  return useQuery({
    queryKey: ["upcoming-agents"],
    queryFn: () => apiFetch<UpcomingAgent[]>("/feedback/upcoming-agents"),
  })
}

// Toggle vote on upcoming agent
export function useToggleUpcomingVote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (agentId: string) =>
      apiFetch<{ voted: boolean; voteCount: number }>(`/feedback/upcoming-agents/${agentId}/vote`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["upcoming-agents"] })
    },
  })
}

// Admin: List ALL feedback without user-specific filters
export function useAdminFeedbackList() {
  return useQuery({
    queryKey: ["feedback", "admin"],
    queryFn: () => apiFetch<FeedbackPost[]>("/feedback?sort=votes"),
  })
}

// Admin manage upcoming agents
export function useCreateUpcomingAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; tagline: string; description?: string; emoji?: string; color?: string; order?: number }) =>
      apiFetch("/feedback/upcoming-agents", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["upcoming-agents"] }),
  })
}

export function useUpdateUpcomingAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; tagline?: string; isVisible?: boolean; order?: number; description?: string | null; emoji?: string | null; color?: string | null }) =>
      apiFetch(`/feedback/upcoming-agents/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["upcoming-agents"] }),
  })
}

export function useDeleteUpcomingAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/feedback/upcoming-agents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["upcoming-agents"] }),
  })
}

// Admin: Update status
export function useUpdateFeedbackStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status: FeedbackStatus; roadmapEta?: string | null; adminReply?: string | null; adminNote?: string | null }) =>
      apiFetch(`/feedback/${id}/status`, { method: "PATCH", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback"] })
    },
  })
}
