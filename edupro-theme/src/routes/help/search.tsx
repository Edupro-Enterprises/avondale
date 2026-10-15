import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { KbHeader } from '@/components/layout/kb-header'
import { Main } from '@/components/layout/main'
import { KbFilterBar } from '@/features/knowledge-base/components/kb-filter-bar'
import { KbArticleListItem } from '@/features/knowledge-base/components/kb-article-list-item'
import { useKbFilters } from '@/features/knowledge-base/hooks/use-kb-filters'
import { matchesKbFilters } from '@/features/knowledge-base/lib/filters'
import { search as searchKbArticles } from '@/features/knowledge-base/lib/search'
import { getAllArticles } from '@/features/knowledge-base/lib/content-loader'
import { useKbAnalyticsStore } from '@/features/knowledge-base/stores/kb-analytics-store'

const searchParamsSchema = z.object({ q: z.string().optional() })

export const Route = createFileRoute('/help/search')({
  validateSearch: searchParamsSchema,
  component: KbSearchPage,
})

function KbSearchPage() {
  const { q } = Route.useSearch()
  const [query, setQuery] = useState(q ?? '')
  const allArticles = useMemo(() => getAllArticles().filter((a) => !a.frontmatter.draft), [])
  const { filters, isActive, toggle, clear } = useKbFilters(allArticles)

  const results = useMemo(() => {
    if (!query.trim()) return []
    return searchKbArticles(query, { filter: (a) => matchesKbFilters(a, filters) })
  }, [query, filters])

  // Debounced so a batch of keystrokes doesn't flood the local analytics
  // log with one event per character -- only the query the reader settles
  // on gets tracked.
  const track = useKbAnalyticsStore((s) => s.track)
  useEffect(() => {
    if (!query.trim()) return
    const timer = setTimeout(() => {
      track({ type: 'search', query, resultCount: results.length })
    }, 500)
    return () => clearTimeout(timer)
  }, [query, results.length, track])

  return (
    <>
      <KbHeader />
      <Main>
        <h1 className='mb-4 text-2xl font-bold tracking-tight'>Search the Knowledge Base</h1>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search articles, checklists, templates…'
          className='mb-4'
        />
        <div className='mb-4'>
          <KbFilterBar filters={filters} isActive={isActive} toggle={toggle} clear={clear} />
        </div>

        {!query.trim() && (
          <p className='text-sm text-muted-foreground'>Start typing to search every published article.</p>
        )}
        {query.trim() && results.length === 0 && (
          <p className='text-sm text-muted-foreground'>No results for "{query}".</p>
        )}

        <div className='space-y-3'>
          {results.map(({ article }) => (
            <KbArticleListItem key={article.frontmatter.slug} article={article} />
          ))}
        </div>
      </Main>
    </>
  )
}
