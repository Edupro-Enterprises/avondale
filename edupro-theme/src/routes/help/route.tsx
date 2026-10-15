import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { requireAnyAuth } from '@/lib/frappe/route-guard'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { kbSidebarData } from '@/features/knowledge-base/lib/kb-sidebar-data'
import { useKbServerSync } from '@/features/knowledge-base/hooks/use-kb-server-sync'
import { useKbAnalyticsStore } from '@/features/knowledge-base/stores/kb-analytics-store'
import { flushAnalyticsEvents } from '@/lib/frappe/knowledge-base'

const ANALYTICS_FLUSH_INTERVAL_MS = 30_000

/** The knowledge base is reachable by any signed-in role -- unlike every
 * other shell (each pinned to one role, see roles.ts), so it gets its own
 * top-level layout route instead of nesting under _authenticated/_portal/
 * etc. Reuses AuthenticatedLayout wholesale with the KB's own content-tree
 * sidebar data in place of a role's static nav. */
export const Route = createFileRoute('/help')({
  beforeLoad: requireAnyAuth(),
  component: KbRootLayout,
})

function KbRootLayout() {
  useKbServerSync()
  useAnalyticsFlush()
  return <AuthenticatedLayout sidebarData={kbSidebarData} />
}

/** Periodically sends whatever's queued in the local analytics store to
 * the backend (Phase 2's knowledge_base.track_events) and clears the
 * queue on success -- a failed flush just leaves events queued for the
 * next tick, since this is best-effort telemetry. */
function useAnalyticsFlush() {
  useEffect(() => {
    const timer = setInterval(async () => {
      const { events, clear } = useKbAnalyticsStore.getState()
      if (events.length === 0) return
      try {
        await flushAnalyticsEvents(events.map((e) => e.event))
        clear()
      } catch {
        // left queued -- retried on the next tick
      }
    }, ANALYTICS_FLUSH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])
}
