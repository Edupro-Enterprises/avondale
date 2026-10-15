import { useState } from 'react'
import { type SearchEntry } from '@/lib/search-index'

const STORAGE_KEY = 'edupro-recent-entities'
const MAX_RECENTS = 5

function readRecents(): SearchEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SearchEntry[]) : []
  } catch {
    return []
  }
}

function writeRecents(entries: SearchEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage unavailable -- recents just won't persist
  }
}

/** Tracks the last few entity records opened via ⌘K search (AUD-047),
 * surfaced at the top of the palette on an empty query so a bursar
 * working the same student or debtor case repeatedly all day doesn't
 * have to re-search or re-navigate the sidebar each time. */
export function useRecentEntities() {
  const [recents, setRecents] = useState<SearchEntry[]>(() => readRecents())

  function recordVisit(entry: SearchEntry) {
    setRecents((prev) => {
      const next = [entry, ...prev.filter((r) => !(r.type === entry.type && r.id === entry.id))].slice(0, MAX_RECENTS)
      writeRecents(next)
      return next
    })
  }

  return { recents, recordVisit }
}
