import { useMemo, useState } from 'react'
import type { KbArticle } from '@/features/knowledge-base/types/kb'
import {
  EMPTY_KB_FILTERS,
  filterKbArticles,
  hasActiveKbFilters,
  type KbFilterState,
} from '@/features/knowledge-base/lib/filters'

export function useKbFilters(articles: KbArticle[]) {
  const [filters, setFilters] = useState<KbFilterState>(EMPTY_KB_FILTERS)

  const filtered = useMemo(() => filterKbArticles(articles, filters), [articles, filters])
  const isActive = hasActiveKbFilters(filters)

  function toggle<K extends keyof KbFilterState>(key: K, value: KbFilterState[K][number]) {
    setFilters((prev) => {
      const current = prev[key] as string[]
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [key]: next }
    })
  }

  function clear() {
    setFilters(EMPTY_KB_FILTERS)
  }

  return { filters, filtered, isActive, toggle, setFilters, clear }
}
