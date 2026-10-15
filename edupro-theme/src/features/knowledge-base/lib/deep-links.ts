/** Maps a stable "context key" to a KB article slug, so an existing
 * Bursar/SDC/Head/etc. screen can render a "?" help icon that deep-links
 * straight to the relevant article instead of dropping the reader on the
 * KB home page to go find it themselves.
 *
 * Infrastructure only for now -- not yet wired into any existing screen
 * (that rollout is later KB work, once there's enough real content for
 * the links to actually resolve to something useful). Content authors
 * add an entry here when an article is written to support a specific
 * screen; screens look the key up, they never hardcode a slug/URL. */
import { getArticleBySlug } from './content-loader'

export const KB_DEEP_LINKS: Record<string, string> = {
  // 'bursar.cash-up': 'how-to-do-a-cash-up',
}

export interface KbDeepLink {
  slug: string
  to: '/help/$sectionId/$chapterId/$slug'
  params: { sectionId: string; chapterId: string; slug: string }
}

/** Resolves a context key to real route params, or null if the key has no
 * entry yet or the article it names doesn't exist (renamed/removed) --
 * callers should hide the help icon entirely rather than link to a 404. */
export function resolveKbDeepLink(contextKey: string): KbDeepLink | null {
  const slug = KB_DEEP_LINKS[contextKey]
  if (!slug) return null
  const article = getArticleBySlug(slug)
  if (!article) return null
  return {
    slug,
    to: '/help/$sectionId/$chapterId/$slug',
    params: { sectionId: article.sectionId, chapterId: article.chapterId, slug },
  }
}
