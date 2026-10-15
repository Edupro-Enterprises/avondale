/** Real backend sync for the KB's local-first features (Phase 2) -- see
 * the backend repo's edupro_school_fees/knowledge_base.py for the actual
 * whitelisted methods this calls, and docs/knowledge-base/architecture.md
 * for how this fits together with the local zustand stores. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { KbAnalyticsEvent } from '@/features/knowledge-base/stores/kb-analytics-store'

const MODULE = 'edupro_school_fees.knowledge_base'

export interface KbServerState {
  favourites: string[]
  progress: Record<string, 'In Progress' | 'Read'>
  votes: Record<string, 'up' | 'down'>
}

export interface KbServerComment {
  id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
}

export function useKbServerState() {
  return useQuery({
    queryKey: ['kb-server-state'],
    queryFn: async () => (await api.get<{ message: KbServerState }>(`/api/method/${MODULE}.get_my_kb_state`)).message,
    staleTime: 60_000,
  })
}

export function useToggleFavouriteSync() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (articleSlug: string) =>
      (await api.post<{ message: { is_favourite: boolean } }>(`/api/method/${MODULE}.toggle_favourite`, { article_slug: articleSlug }))
        .message,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kb-server-state'] }),
    meta: { silent: true },
  })
}

export function useUpdateProgressSync() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { articleSlug: string; status: 'In Progress' | 'Read' }) =>
      (
        await api.post<{ message: { status: string } }>(`/api/method/${MODULE}.update_progress`, {
          article_slug: vars.articleSlug,
          status: vars.status,
        })
      ).message,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kb-server-state'] }),
    meta: { silent: true },
  })
}

export function useSubmitFeedbackSync() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { articleSlug: string; vote: 'up' | 'down'; comment?: string }) =>
      (
        await api.post<{ message: { vote: string } }>(`/api/method/${MODULE}.submit_feedback`, {
          article_slug: vars.articleSlug,
          vote: vars.vote,
          comment: vars.comment,
        })
      ).message,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kb-server-state'] }),
    meta: { silent: true },
  })
}

export function useKbComments(articleSlug: string) {
  return useQuery({
    queryKey: ['kb-comments', articleSlug],
    queryFn: async () =>
      (await api.get<{ message: KbServerComment[] }>(`/api/method/${MODULE}.get_comments?article_slug=${encodeURIComponent(articleSlug)}`))
        .message,
  })
}

export function useAddComment(articleSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) =>
      (
        await api.post<{ message: KbServerComment }>(`/api/method/${MODULE}.add_comment`, {
          article_slug: articleSlug,
          body,
        })
      ).message,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kb-comments', articleSlug] }),
  })
}

export function useDeleteComment(articleSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) =>
      (await api.post<{ message: { deleted: string } }>(`/api/method/${MODULE}.delete_comment`, { comment_name: commentId })).message,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kb-comments', articleSlug] }),
  })
}

/** Sends whatever's in the local analytics queue in one batch. Fire-and-
 * forget from the caller's point of view -- analytics is best-effort, a
 * failed flush just leaves the queue to retry next time. */
export async function flushAnalyticsEvents(events: KbAnalyticsEvent[]): Promise<{ inserted: number; skipped: number }> {
  return (
    await api.post<{ message: { inserted: number; skipped: number } }>(`/api/method/${MODULE}.track_events`, { events })
  ).message
}
