import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KbHeader } from '@/components/layout/kb-header'
import { Main } from '@/components/layout/main'
import { getSections } from '@/features/knowledge-base/lib/content-loader'
import { KB_ROLE_LANDING_COPY } from '@/features/knowledge-base/lib/role-landing-config'
import { KB_ROLES } from '@/features/knowledge-base/types/kb'

export const Route = createFileRoute('/help/')({
  component: KbHome,
})

/** General landing page: role quick-links up top (each role's own
 * audience-filtered reading list, see routes/help/role/$role.tsx), then
 * the full section/chapter/article index below for anyone who'd rather
 * just browse everything. */
function KbHome() {
  const sections = getSections()

  return (
    <>
      <KbHeader />
      <Main>
        <h1 className='mb-1 text-2xl font-bold tracking-tight'>Knowledge Base</h1>
        <p className='mb-6 text-muted-foreground'>Financial management guidance for schools.</p>

        <div className='mb-8'>
          <p className='mb-2 text-sm font-semibold'>Browse by role</p>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
            {KB_ROLES.map((role) => (
              <Link
                key={role}
                to='/help/role/$role'
                params={{ role }}
                className='rounded-lg border px-3 py-2 text-sm capitalize transition-colors hover:bg-accent'
              >
                {KB_ROLE_LANDING_COPY[role].title.replace(/^For /, '')}
              </Link>
            ))}
          </div>
        </div>

        {sections.length === 0 && (
          <p className='text-sm text-muted-foreground'>No published articles yet.</p>
        )}

        <div className='grid gap-4 md:grid-cols-2'>
          {sections.map((section) => {
            const chaptersWithArticles = section.chapters.filter((c) =>
              c.articles.some((a) => !a.frontmatter.draft)
            )
            if (chaptersWithArticles.length === 0) return null
            return (
              <Card key={section.id}>
                <CardHeader>
                  <CardTitle>{section.meta.title}</CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  {chaptersWithArticles.map((chapter) => (
                    <div key={chapter.id}>
                      <p className='mb-1 text-sm font-semibold'>{chapter.meta.title}</p>
                      <ul className='space-y-0.5 pl-3 text-sm'>
                        {chapter.articles
                          .filter((a) => !a.frontmatter.draft)
                          .map((article) => (
                            <li key={article.frontmatter.slug}>
                              <Link
                                to='/help/$sectionId/$chapterId/$slug'
                                params={{ sectionId: section.id, chapterId: chapter.id, slug: article.frontmatter.slug }}
                                className='text-primary hover:underline'
                              >
                                {article.frontmatter.title}
                              </Link>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </Main>
    </>
  )
}
