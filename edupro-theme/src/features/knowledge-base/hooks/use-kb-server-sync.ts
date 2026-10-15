import { useEffect } from 'react'
import { useKbServerState } from '@/lib/frappe/knowledge-base'
import { useKbLibraryStore, type KbReadStatus } from '@/features/knowledge-base/stores/kb-library-store'
import { useKbFeedbackStore } from '@/features/knowledge-base/stores/kb-feedback-store'

const SERVER_STATUS_TO_LOCAL: Record<string, KbReadStatus> = {
  'In Progress': 'in-progress',
  Read: 'read',
}

/** Pulls the signed-in user's real favourites/progress/votes down from the
 * backend and overwrites the local zustand stores with it -- server state
 * is the source of truth once this call succeeds (the local stores exist
 * for instant optimistic UI and offline resilience, not as a second
 * source of truth). Call this once, high in the KB route tree (see
 * routes/help/route.tsx), not per-page. */
export function useKbServerSync() {
  const { data } = useKbServerState()

  useEffect(() => {
    if (!data) return

    useKbLibraryStore.setState({
      favourites: data.favourites,
      progress: Object.fromEntries(
        Object.entries(data.progress)
          .map(([slug, status]) => [slug, SERVER_STATUS_TO_LOCAL[status]])
          .filter(([, status]) => status !== undefined)
      ),
    })

    useKbFeedbackStore.setState({
      entries: Object.entries(data.votes).map(([slug, vote]) => ({
        slug,
        vote,
        submittedAt: new Date().toISOString(),
      })),
    })
  }, [data])
}
