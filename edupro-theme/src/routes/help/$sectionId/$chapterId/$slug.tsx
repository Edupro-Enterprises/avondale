import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { KbHeader } from '@/components/layout/kb-header'
import { Main } from '@/components/layout/main'
import { KbArticleTemplate } from '@/features/knowledge-base/components/kb-article-template'
import { KbComments } from '@/features/knowledge-base/components/kb-comments'
import { getArticle, getArticleComponent } from '@/features/knowledge-base/lib/content-loader'

export const Route = createFileRoute('/help/$sectionId/$chapterId/$slug')({
  component: KbArticlePage,
})

function KbArticlePage() {
  const { sectionId, chapterId, slug } = Route.useParams()
  const article = getArticle(sectionId, chapterId, slug)

  // Keyed by path (not just a bare Component | null) so a stale resolved
  // component from the *previous* article never flashes while the new
  // one is loading -- the render below only trusts `resolved` when its
  // path matches the article currently being shown.
  const [resolved, setResolved] = useState<{ path: string; Component: Awaited<ReturnType<typeof getArticleComponent>>['Component'] } | null>(null)

  useEffect(() => {
    if (!article) return
    let cancelled = false
    getArticleComponent(article).then(({ Component }) => {
      if (!cancelled) setResolved({ path: article.path, Component })
    })
    return () => {
      cancelled = true
    }
  }, [article])

  const Component = resolved && article && resolved.path === article.path ? resolved.Component : null

  return (
    <>
      <KbHeader />
      <Main>
        {!article ? (
          <p className='text-sm text-muted-foreground'>Article not found.</p>
        ) : !Component ? (
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' />
            Loading article…
          </div>
        ) : (
          <KbArticleTemplate article={article} Component={Component} />
        )}
        {article && <KbComments slug={article.frontmatter.slug} />}
      </Main>
    </>
  )
}
