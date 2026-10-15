import { createFileRoute, Link } from '@tanstack/react-router'
import { KbHeader } from '@/components/layout/kb-header'
import { Main } from '@/components/layout/main'
import { Faq, FaqItem } from '@/features/knowledge-base/components/mdx/faq'
import { getAllArticles } from '@/features/knowledge-base/lib/content-loader'

export const Route = createFileRoute('/help/faq')({
  component: KbFaqPage,
})

/** Aggregates every article_type: "faq" article into one page, reusing
 * the same Faq/FaqItem accordion components MDX content uses -- an
 * article's excerpt is the short answer here, with a link through to the
 * full article for detail rather than duplicating its body. */
function KbFaqPage() {
  const faqs = getAllArticles().filter((a) => !a.frontmatter.draft && a.frontmatter.article_type === 'faq')

  return (
    <>
      <KbHeader />
      <Main>
        <h1 className='mb-1 text-2xl font-bold tracking-tight'>Frequently Asked Questions</h1>
        <p className='mb-6 text-muted-foreground'>Quick answers to common financial-management questions.</p>

        {faqs.length === 0 ? (
          <p className='text-sm text-muted-foreground'>No FAQs published yet.</p>
        ) : (
          <Faq>
            {faqs.map((article) => (
              <FaqItem key={article.frontmatter.slug} question={article.frontmatter.title}>
                <p>{article.frontmatter.summary ?? article.excerpt}</p>
                <Link
                  to='/help/$sectionId/$chapterId/$slug'
                  params={{ sectionId: article.sectionId, chapterId: article.chapterId, slug: article.frontmatter.slug }}
                  className='mt-1 inline-block text-primary hover:underline'
                >
                  Read more
                </Link>
              </FaqItem>
            ))}
          </Faq>
        )}
      </Main>
    </>
  )
}
