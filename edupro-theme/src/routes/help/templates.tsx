import { createFileRoute } from '@tanstack/react-router'
import { KbHeader } from '@/components/layout/kb-header'
import { Main } from '@/components/layout/main'
import { KbArticleListItem } from '@/features/knowledge-base/components/kb-article-list-item'
import { getAllArticles } from '@/features/knowledge-base/lib/content-loader'

export const Route = createFileRoute('/help/templates')({
  component: KbTemplatesPage,
})

/** Lists every article authored as article_type "template" -- the
 * templates themselves (the actual downloadable files) are content, not
 * scaffolding, so this page is real and functional today but empty until
 * content authors publish the first one. */
function KbTemplatesPage() {
  const templates = getAllArticles().filter((a) => !a.frontmatter.draft && a.frontmatter.article_type === 'template')

  return (
    <>
      <KbHeader />
      <Main>
        <h1 className='mb-1 text-2xl font-bold tracking-tight'>Templates</h1>
        <p className='mb-6 text-muted-foreground'>Ready-to-use forms and templates for school financial management.</p>

        {templates.length === 0 ? (
          <p className='text-sm text-muted-foreground'>No templates published yet.</p>
        ) : (
          <div className='grid gap-3 md:grid-cols-2'>
            {templates.map((article) => (
              <KbArticleListItem key={article.frontmatter.slug} article={article} />
            ))}
          </div>
        )}
      </Main>
    </>
  )
}
