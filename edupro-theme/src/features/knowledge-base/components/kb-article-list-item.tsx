import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import type { KbArticle } from '@/features/knowledge-base/types/kb'

/** Shared result-row rendering for the search page, role landings,
 * templates library, and FAQ listing -- one place for "what does an
 * article look like in a list" instead of four near-duplicate markups. */
export function KbArticleListItem({ article }: { article: KbArticle }) {
  const fm = article.frontmatter
  return (
    <Link
      to='/help/$sectionId/$chapterId/$slug'
      params={{ sectionId: article.sectionId, chapterId: article.chapterId, slug: fm.slug }}
      className='block rounded-lg border p-4 transition-colors hover:bg-accent/50'
    >
      <div className='flex items-center justify-between gap-2'>
        <p className='font-medium'>{fm.title}</p>
        <span className='shrink-0 text-xs text-muted-foreground'>{fm.read_time} min</span>
      </div>
      {(fm.summary || article.excerpt) && (
        <p className='mt-1 line-clamp-2 text-sm text-muted-foreground'>{fm.summary ?? article.excerpt}</p>
      )}
      <div className='mt-2 flex flex-wrap gap-1.5'>
        <Badge variant='secondary' className='capitalize'>
          {fm.article_type.replace('-', ' ')}
        </Badge>
        {fm.audience.slice(0, 3).map((a) => (
          <Badge key={a} variant='outline' className='capitalize'>
            {a}
          </Badge>
        ))}
      </div>
    </Link>
  )
}
