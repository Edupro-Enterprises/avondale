import { createFileRoute } from '@tanstack/react-router'
import { KbHeader } from '@/components/layout/kb-header'
import { Main } from '@/components/layout/main'
import { KbArticleListItem } from '@/features/knowledge-base/components/kb-article-list-item'
import { getAllArticles } from '@/features/knowledge-base/lib/content-loader'
import { KB_ROLE_LANDING_COPY } from '@/features/knowledge-base/lib/role-landing-config'
import { KB_ROLES, type KbRole } from '@/features/knowledge-base/types/kb'

export const Route = createFileRoute('/help/role/$role')({
  component: KbRoleLandingPage,
})

function isKbRole(value: string): value is KbRole {
  return (KB_ROLES as readonly string[]).includes(value)
}

/** One dynamic route for all 7 personas + public, instead of 8 near-
 * identical files -- each still gets its own real URL and its own
 * audience-filtered reading list, just built from one component. */
function KbRoleLandingPage() {
  const { role } = Route.useParams()

  if (!isKbRole(role)) {
    return (
      <>
        <KbHeader />
        <Main>
          <p className='text-sm text-muted-foreground'>Unknown role.</p>
        </Main>
      </>
    )
  }

  const copy = KB_ROLE_LANDING_COPY[role]
  const articles = getAllArticles().filter((a) => {
    if (a.frontmatter.draft) return false
    return role === 'public' || a.frontmatter.audience.includes(role)
  })
  const featured = articles.filter((a) => a.frontmatter.featured)
  const rest = articles.filter((a) => !a.frontmatter.featured)

  return (
    <>
      <KbHeader />
      <Main>
        <h1 className='mb-1 text-2xl font-bold tracking-tight'>{copy.title}</h1>
        <p className='mb-6 text-muted-foreground'>{copy.description}</p>

        {articles.length === 0 && (
          <p className='text-sm text-muted-foreground'>No articles published for this audience yet.</p>
        )}

        {featured.length > 0 && (
          <div className='mb-6'>
            <p className='mb-2 text-sm font-semibold'>Featured</p>
            <div className='space-y-3'>
              {featured.map((article) => (
                <KbArticleListItem key={article.frontmatter.slug} article={article} />
              ))}
            </div>
          </div>
        )}

        {rest.length > 0 && (
          <div>
            <p className='mb-2 text-sm font-semibold'>All articles</p>
            <div className='space-y-3'>
              {rest.map((article) => (
                <KbArticleListItem key={article.frontmatter.slug} article={article} />
              ))}
            </div>
          </div>
        )}
      </Main>
    </>
  )
}
