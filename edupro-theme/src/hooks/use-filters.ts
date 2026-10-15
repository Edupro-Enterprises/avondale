import { useCallback, useEffect, useMemo, useState } from 'react'

export interface FilterGroupDef {
  key: string
  label: string
  options: string[]
}

export interface SavedView {
  name: string
  search: string
  values: Record<string, string | null>
}

type Values = Record<string, string | null>

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage unavailable (private mode, quota) -- filters just won't persist
  }
}

/** Composable AND filtering (search + N single-select groups) with
 * localStorage persistence and named saved views, shared by every
 * FilterBar-driven list page (AUD-019/020). Each page owns a unique
 * `storageKey` so views don't collide across lists. */
export function useFilters(storageKey: string, groups: FilterGroupDef[]) {
  const stateKey = `edupro-filters:${storageKey}`
  const viewsKey = `edupro-filter-views:${storageKey}`

  // Lazy initializers run synchronously on first render, so the persisted
  // value is there from the start -- an effect-based load would race with
  // the persist-effect below and get overwritten by it on mount.
  const [search, setSearch] = useState(
    () => readJSON<{ search: string; values: Values }>(stateKey, { search: '', values: {} }).search
  )
  const [values, setValues] = useState<Values>(
    () => readJSON<{ search: string; values: Values }>(stateKey, { search: '', values: {} }).values
  )
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => readJSON<SavedView[]>(viewsKey, []))

  useEffect(() => {
    writeJSON(stateKey, { search, values })
  }, [stateKey, search, values])

  const setValue = useCallback((key: string, value: string | null) => {
    setValues((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }))
  }, [])

  const clearAll = useCallback(() => {
    setSearch('')
    setValues({})
  }, [])

  const activeCount = useMemo(
    () => Object.values(values).filter(Boolean).length + (search.trim() ? 1 : 0),
    [values, search]
  )

  const chips = useMemo(
    () =>
      groups
        .filter((g) => values[g.key])
        .map((g) => ({ key: g.key, label: `${g.label}: ${values[g.key]}` })),
    [groups, values]
  )

  const saveView = useCallback(
    (name: string) => {
      const next = [...savedViews.filter((v) => v.name !== name), { name, search, values }]
      setSavedViews(next)
      writeJSON(viewsKey, next)
    },
    [savedViews, search, values, viewsKey]
  )

  const applyView = useCallback((view: SavedView) => {
    setSearch(view.search)
    setValues(view.values)
  }, [])

  const deleteView = useCallback(
    (name: string) => {
      const next = savedViews.filter((v) => v.name !== name)
      setSavedViews(next)
      writeJSON(viewsKey, next)
    },
    [savedViews, viewsKey]
  )

  return {
    search,
    setSearch,
    values,
    setValue,
    clearAll,
    activeCount,
    chips,
    savedViews,
    saveView,
    applyView,
    deleteView,
  }
}
