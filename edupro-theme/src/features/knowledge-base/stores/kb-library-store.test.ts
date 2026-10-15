import { beforeEach, describe, expect, it } from 'vitest'
import { useKbLibraryStore } from './kb-library-store'

beforeEach(() => {
  localStorage.clear()
  useKbLibraryStore.setState({ favourites: [], recent: [], progress: {} })
})

describe('kb-library-store', () => {
  it('toggleFavourite adds then removes a slug', () => {
    useKbLibraryStore.getState().toggleFavourite('a')
    expect(useKbLibraryStore.getState().favourites).toEqual(['a'])

    useKbLibraryStore.getState().toggleFavourite('a')
    expect(useKbLibraryStore.getState().favourites).toEqual([])
  })

  it('recordVisit dedupes and moves a re-visited slug to the front', () => {
    const { recordVisit } = useKbLibraryStore.getState()
    recordVisit('a')
    recordVisit('b')
    recordVisit('a')

    const slugs = useKbLibraryStore.getState().recent.map((r) => r.slug)
    expect(slugs).toEqual(['a', 'b'])
  })

  it('recordVisit caps the recent list at 10', () => {
    const { recordVisit } = useKbLibraryStore.getState()
    for (let i = 0; i < 15; i++) recordVisit(`slug-${i}`)
    expect(useKbLibraryStore.getState().recent).toHaveLength(10)
    expect(useKbLibraryStore.getState().recent[0].slug).toBe('slug-14')
  })

  it('recordVisit seeds progress as in-progress without overwriting an existing status', () => {
    const { recordVisit, markProgress } = useKbLibraryStore.getState()
    recordVisit('a')
    expect(useKbLibraryStore.getState().progress.a).toBe('in-progress')

    markProgress('a', 'read')
    recordVisit('a')
    expect(useKbLibraryStore.getState().progress.a).toBe('read')
  })
})
