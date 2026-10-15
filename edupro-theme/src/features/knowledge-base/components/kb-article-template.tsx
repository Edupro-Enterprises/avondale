import { useEffect, useRef, type ComponentType } from 'react'
import { Link } from '@tanstack/react-router'
import { Printer, ThumbsUp, ThumbsDown, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { kbMdxComponents } from '@/features/knowledge-base/components/mdx'
import { KbToc } from '@/features/knowledge-base/components/kb-toc'
import { getRelatedArticles } from '@/features/knowledge-base/lib/content-loader'
import { useKbLibraryStore } from '@/features/knowledge-base/stores/kb-library-store'
import { useKbFeedbackStore } from '@/features/knowledge-base/stores/kb-feedback-store'
import { useKbAnalyticsStore } from '@/features/knowledge-base/stores/kb-analytics-store'
import { useSubmitFeedbackSync, useToggleFavouriteSync, useUpdateProgressSync } from '@/lib/frappe/knowledge-base'
import type { KbArticle } from '@/features/knowledge-base/types/kb'

type MdxArticleComponent = ComponentType<{ components?: typeof kbMdxComponents }>

/** "Was this helpful?" -- the local kb-feedback-store gives instant UI
 * feedback; useSubmitFeedbackSync fires the same vote to the real backend
 * (Phase 2) alongside it. A sync failure (offline, etc.) never blocks the
 * local vote from registering -- see useKbServerSync for how the next
 * successful state fetch reconciles the two. */
function KbFeedback({ slug }: { slug: string }) {
  const voteFor = useKbFeedbackStore((s) => s.voteFor)
  const submit = useKbFeedbackStore((s) => s.submit)
  const track = useKbAnalyticsStore((s) => s.track)
  const syncFeedback = useSubmitFeedbackSync()
  const vote = voteFor(slug)

  function handleVote(next: 'up' | 'down') {
    submit(slug, next)
    track({ type: 'feedback', slug, vote: next })
    syncFeedback.mutate({ articleSlug: slug, vote: next })
  }

  return (
    <div className='mt-8 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm print:hidden'>
      <span className='font-medium'>Was this article helpful?</span>
      <Button
        type='button'
        variant={vote === 'up' ? 'default' : 'outline'}
        size='icon'
        className='size-8'
        onClick={() => handleVote('up')}
      >
        <ThumbsUp className='size-4' />
      </Button>
      <Button
        type='button'
        variant={vote === 'down' ? 'default' : 'outline'}
        size='icon'
        className='size-8'
        onClick={() => handleVote('down')}
      >
        <ThumbsDown className='size-4' />
      </Button>
      {vote && <span className='text-xs text-muted-foreground'>Thanks for the feedback.</span>}
    </div>
  )
}

function KbFavouriteToggle({ slug }: { slug: string }) {
  const isFavourite = useKbLibraryStore((s) => s.favourites.includes(slug))
  const toggleFavourite = useKbLibraryStore((s) => s.toggleFavourite)
  const syncFavourite = useToggleFavouriteSync()
  return (
    <Button
      type='button'
      variant='outline'
      size='icon'
      className='size-8 print:hidden'
      aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
      onClick={() => {
        toggleFavourite(slug)
        syncFavourite.mutate(slug)
      }}
    >
      <Star className={cn('size-4', isFavourite && 'fill-amber-400 text-amber-400')} />
    </Button>
  )
}

/** The fixed 12-block layout every KB article renders through: breadcrumb
 * (free, from Main/PageBreadcrumb), title+summary, metadata bar, freshness
 * banner, school applicability, table of contents, body, legal references,
 * related articles, feedback, tags, print action. */
export function KbArticleTemplate({ article, Component }: { article: KbArticle; Component: MdxArticleComponent }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)
  const fm = article.frontmatter
  const related = getRelatedArticles(article)
  const hasApplicability = (fm.school_type?.length ?? 0) > 0 || (fm.school_level?.length ?? 0) > 0

  const recordVisit = useKbLibraryStore((s) => s.recordVisit)
  const markProgress = useKbLibraryStore((s) => s.markProgress)
  const trackAnalytics = useKbAnalyticsStore((s) => s.track)
  const syncProgress = useUpdateProgressSync()

  // Visit + view tracked once per article open; "read" progress tracked
  // separately, when the reader actually scrolls to the end of the body
  // (see the bottom sentinel below) rather than assumed on open. The
  // server sync only fires "In Progress" if the article isn't already
  // marked Read there -- a revisit of a finished article shouldn't
  // downgrade its status.
  useEffect(() => {
    recordVisit(fm.slug)
    trackAnalytics({ type: 'article_view', slug: fm.slug })
    if (useKbLibraryStore.getState().progress[fm.slug] !== 'read') {
      syncProgress.mutate({ articleSlug: fm.slug, status: 'In Progress' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncProgress is a fresh mutation object every render; only re-run when the article itself changes
  }, [fm.slug, recordVisit, trackAnalytics])

  useEffect(() => {
    const sentinel = bottomSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          markProgress(fm.slug, 'read')
          syncProgress.mutate({ articleSlug: fm.slug, status: 'Read' })
        }
      },
      { threshold: 1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same as above
  }, [fm.slug, markProgress])

  return (
    <div className='flex gap-8'>
      <article className='kb-print-article min-w-0 flex-1'>
        <header className='mb-4 flex items-start justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{fm.title}</h1>
            {fm.summary && <p className='mt-2 text-muted-foreground'>{fm.summary}</p>}
          </div>
          <KbFavouriteToggle slug={fm.slug} />
        </header>

        <div className='mb-4 flex flex-wrap items-center gap-2'>
          <Badge variant='secondary' className='capitalize'>
            {fm.article_type.replace('-', ' ')}
          </Badge>
          {fm.audience.map((a) => (
            <Badge key={a} variant='outline' className='capitalize'>
              {a}
            </Badge>
          ))}
          <span className='text-xs text-muted-foreground'>{fm.read_time} min read</span>
          {fm.status && fm.status !== 'current' && (
            <Badge variant='destructive' className='capitalize'>
              {fm.status}
            </Badge>
          )}
        </div>

        <div className='mb-6 rounded-lg border bg-muted/30 px-4 py-2 text-xs text-muted-foreground'>
          Reviewed {fm.last_reviewed} by {fm.reviewed_by} · Current as of {fm.current_as_of} · v{fm.version}
        </div>

        {hasApplicability && (
          <div className='mb-6 flex flex-wrap gap-2'>
            {fm.school_type?.map((t) => (
              <Badge key={t} variant='outline' className='capitalize'>
                {t}
              </Badge>
            ))}
            {fm.school_level?.map((l) => (
              <Badge key={l} variant='outline' className='capitalize'>
                {l}
              </Badge>
            ))}
          </div>
        )}

        <Separator className='mb-6' />

        <div ref={bodyRef} className={cn('prose prose-sm dark:prose-invert max-w-none')}>
          <Component components={kbMdxComponents} />
        </div>
        <div ref={bottomSentinelRef} aria-hidden='true' />

        {fm.legal_references.length > 0 && (
          <div className='mt-8 border-t pt-4 text-xs text-muted-foreground'>
            <p className='mb-1 font-semibold text-foreground'>Legal references</p>
            <ul className='list-inside list-disc space-y-0.5'>
              {fm.legal_references.map((ref) => (
                <li key={ref}>{ref}</li>
              ))}
            </ul>
          </div>
        )}

        {related.length > 0 && (
          <div className='mt-8 border-t pt-4'>
            <p className='mb-2 text-sm font-semibold'>Related articles</p>
            <ul className='space-y-1 text-sm'>
              {related.map((r) => (
                <li key={r.frontmatter.slug}>
                  <Link
                    to='/help/$sectionId/$chapterId/$slug'
                    params={{ sectionId: r.sectionId, chapterId: r.chapterId, slug: r.frontmatter.slug }}
                    className='text-primary hover:underline'
                  >
                    {r.frontmatter.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <KbFeedback slug={fm.slug} />

        {fm.tags.length > 0 && (
          <div className='mt-6 flex flex-wrap gap-1.5'>
            {fm.tags.map((t) => (
              <Badge key={t} variant='outline'>
                {t}
              </Badge>
            ))}
          </div>
        )}

        <div className='mt-6 print:hidden'>
          <Button type='button' variant='outline' size='sm' onClick={() => window.print()}>
            <Printer />
            Print this article
          </Button>
        </div>
      </article>

      <KbToc containerRef={bodyRef} />
    </div>
  )
}
