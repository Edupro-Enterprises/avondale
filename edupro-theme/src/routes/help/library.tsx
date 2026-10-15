import { createFileRoute } from '@tanstack/react-router'
import { KbHeader } from '@/components/layout/kb-header'
import { Main } from '@/components/layout/main'
import { KbArticleListItem } from '@/features/knowledge-base/components/kb-article-list-item'
import { useKbLibraryStore } from '@/features/knowledge-base/stores/kb-library-store'
import { getArticleBySlug } from '@/features/knowledge-base/lib/content-loader'

export const Route = createFileRoute('/help/library')({
  component: KbLibraryPage,
})

/** "My stuff" -- favourites, recently viewed, and reading progress, all
 * local to this browser (kb-library-store). Resolves each stored slug
 * back to a real article, silently dropping any that no longer exist
 * (content gets renamed/removed; a stale localStorage entry shouldn't
 * crash the page). */
function KbLibraryPage() {
  const favourites = useKbLibraryStore((s) => s.favourites)
  const recent = useKbLibraryStore((s) => s.recent)
  const progress = useKbLibraryStore((s) => s.progress)

  const favouriteArticles = favourites.map(getArticleBySlug).filter((a) => a !== undefined)
  const recentArticles = recent.map((r) => getArticleBySlug(r.slug)).filter((a) => a !== undefined)
  const inProgressArticles = Object.entries(progress)
    .filter(([, status]) => status === 'in-progress')
    .map(([slug]) => getArticleBySlug(slug))
    .filter((a) => a !== undefined)

  return (
    <>
      <KbHeader />
      <Main>
        <h1 className='mb-1 text-2xl font-bold tracking-tight'>My Library</h1>
        <p className='mb-6 text-muted-foreground'>Your favourites, recent reads, and progress -- saved to this browser only.</p>

        <Section title='Favourites' articles={favouriteArticles} empty='Star an article to save it here.' />
        <Section title='Continue reading' articles={inProgressArticles} empty='Nothing in progress.' />
        <Section title='Recently viewed' articles={recentArticles} empty='Articles you open will show up here.' />
      </Main>
    </>
  )
}

function Section({ title, articles, empty }: { title: string; articles: ReturnType<typeof getArticleBySlug>[]; empty: string }) {
  const list = articles.filter((a) => a !== undefined)
  return (
    <div className='mb-8'>
      <p className='mb-2 text-sm font-semibold'>{title}</p>
      {list.length === 0 ? (
        <p className='text-sm text-muted-foreground'>{empty}</p>
      ) : (
        <div className='space-y-3'>
          {list.map((article) => (
            <KbArticleListItem key={article.frontmatter.slug} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}
