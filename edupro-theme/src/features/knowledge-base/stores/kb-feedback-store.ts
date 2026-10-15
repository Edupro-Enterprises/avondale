import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface KbFeedbackEntry {
  slug: string
  vote: 'up' | 'down'
  comment?: string
  submittedAt: string
}

interface KbFeedbackState {
  entries: KbFeedbackEntry[]
  voteFor: (slug: string) => 'up' | 'down' | null
  submit: (slug: string, vote: 'up' | 'down', comment?: string) => void
}

/** A local queue, not a real submission -- there is no feedback endpoint
 * yet (Phase 2). Persisting it means a vote survives navigation/reload
 * instead of resetting on every article visit, and gives Phase 2 a ready
 * -made local batch to flush once a real endpoint exists. */
export const useKbFeedbackStore = create<KbFeedbackState>()(
  persist(
    (set, get) => ({
      entries: [],
      voteFor: (slug) => get().entries.find((e) => e.slug === slug)?.vote ?? null,
      submit: (slug, vote, comment) =>
        set((state) => ({
          entries: [...state.entries.filter((e) => e.slug !== slug), { slug, vote, comment, submittedAt: new Date().toISOString() }],
        })),
    }),
    { name: 'edupro-kb-feedback' }
  )
)
