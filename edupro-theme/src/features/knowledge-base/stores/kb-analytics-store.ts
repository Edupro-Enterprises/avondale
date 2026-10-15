import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_EVENTS = 500

export type KbAnalyticsEvent =
  | { type: 'article_view'; slug: string }
  | { type: 'search'; query: string; resultCount: number }
  | { type: 'feedback'; slug: string; vote: 'up' | 'down' }

interface KbAnalyticsEntry {
  event: KbAnalyticsEvent
  at: string
}

interface KbAnalyticsState {
  events: KbAnalyticsEntry[]
  track: (event: KbAnalyticsEvent) => void
  /** No real endpoint exists yet (Phase 2) -- clears the local batch, as a
   * real flush would after a successful send. Kept separate from track()
   * so Phase 2 only has to implement the POST and call this after. */
  clear: () => void
}

/** Local batching only -- events accumulate in a capped ring buffer
 * instead of being sent anywhere, since there's no analytics endpoint
 * yet. Wiring is real (article views, searches, feedback all call
 * track() from where they actually happen), so Phase 2 only needs to add
 * the network call. */
export const useKbAnalyticsStore = create<KbAnalyticsState>()(
  persist(
    (set) => ({
      events: [],
      track: (event) =>
        set((state) => ({
          events: [...state.events, { event, at: new Date().toISOString() }].slice(-MAX_EVENTS),
        })),
      clear: () => set({ events: [] }),
    }),
    { name: 'edupro-kb-analytics' }
  )
)
