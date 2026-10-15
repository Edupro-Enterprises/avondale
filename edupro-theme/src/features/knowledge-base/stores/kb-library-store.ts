import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_RECENT = 10

export type KbReadStatus = 'in-progress' | 'read'

interface KbRecentEntry {
  slug: string
  visitedAt: string
}

interface KbLibraryState {
  favourites: string[]
  recent: KbRecentEntry[]
  progress: Record<string, KbReadStatus>
  toggleFavourite: (slug: string) => void
  recordVisit: (slug: string) => void
  markProgress: (slug: string, status: KbReadStatus) => void
}

/** "My stuff" in the KB -- favourites, recently-viewed, and per-article
 * read progress -- backed by localStorage the same way useSchoolBrandingStore
 * is, since none of this is server data yet (Phase 2 adds a real backend
 * sync; this is the local-first version the spec calls for first). */
export const useKbLibraryStore = create<KbLibraryState>()(
  persist(
    (set) => ({
      favourites: [],
      recent: [],
      progress: {},
      toggleFavourite: (slug) =>
        set((state) => ({
          favourites: state.favourites.includes(slug)
            ? state.favourites.filter((s) => s !== slug)
            : [...state.favourites, slug],
        })),
      recordVisit: (slug) =>
        set((state) => ({
          recent: [{ slug, visitedAt: new Date().toISOString() }, ...state.recent.filter((r) => r.slug !== slug)].slice(
            0,
            MAX_RECENT
          ),
          progress: { ...state.progress, [slug]: state.progress[slug] ?? 'in-progress' },
        })),
      markProgress: (slug, status) => set((state) => ({ progress: { ...state.progress, [slug]: status } })),
    }),
    { name: 'edupro-kb-library' }
  )
)
