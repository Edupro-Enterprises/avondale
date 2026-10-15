/** Client-side full-text search over every published article, via Fuse.js.
 * Decoupled from the specific filter-dimension shape in filters.ts (a
 * plain predicate instead) so this module has no dependency on Step 7 --
 * kb-search.tsx/kb-filters can compose a predicate from whatever filter
 * state they hold. */
import Fuse, { type IFuseOptions } from 'fuse.js'
import { getAllArticles, getSection, getChapter } from './content-loader'
import type { KbArticle } from '@/features/knowledge-base/types/kb'

export interface KbSearchDocument {
  article: KbArticle
  title: string
  excerpt: string
  body: string
  tags: string[]
  audience: string[]
  sectionTitle: string
  chapterTitle: string
}

export interface KbSearchResult {
  article: KbArticle
  score: number
  matches: readonly { key?: string; value?: string; indices: readonly [number, number][] }[]
}

const FUSE_OPTIONS: IFuseOptions<KbSearchDocument> = {
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 2,
  keys: [
    { name: 'title', weight: 3 },
    { name: 'excerpt', weight: 2 },
    { name: 'tags', weight: 2 },
    { name: 'sectionTitle', weight: 1.5 },
    { name: 'chapterTitle', weight: 1.5 },
    { name: 'audience', weight: 1 },
    { name: 'body', weight: 1 },
  ],
}

let cachedFuse: Fuse<KbSearchDocument> | null = null
let cachedDocs: KbSearchDocument[] | null = null

function buildDocuments(): KbSearchDocument[] {
  return getAllArticles()
    .filter((article) => !article.frontmatter.draft)
    .map((article) => ({
      article,
      title: article.frontmatter.title,
      excerpt: article.excerpt,
      body: article.body,
      tags: article.frontmatter.tags,
      audience: article.frontmatter.audience,
      sectionTitle: getSection(article.sectionId)?.meta.title ?? article.sectionId,
      chapterTitle: getChapter(article.sectionId, article.chapterId)?.meta.title ?? article.chapterId,
    }))
}

function getFuse(): Fuse<KbSearchDocument> {
  if (!cachedFuse || !cachedDocs) {
    cachedDocs = buildDocuments()
    cachedFuse = new Fuse(cachedDocs, FUSE_OPTIONS)
  }
  return cachedFuse
}

/** Recomputes the index from the current content tree -- call this if
 * content-loader's cache was reset (tests) or content changes at runtime
 * (it doesn't, today, but this keeps the two caches from silently drifting
 * apart if that ever changes). */
export function rebuildSearchIndex(): void {
  cachedDocs = buildDocuments()
  cachedFuse = new Fuse(cachedDocs, FUSE_OPTIONS)
}

export interface KbSearchOptions {
  limit?: number
  /** Composed from whatever filter state the caller holds (audience,
   * section, article_type, etc.) -- see hooks/use-kb-filters.ts. */
  filter?: (article: KbArticle) => boolean
}

const TYPE_PREFIXES = new Map<string, (a: KbArticle) => boolean>([
  ['@', (a) => a.frontmatter.article_type !== 'template'],
  ['#', (a) => a.frontmatter.article_type === 'template'],
])

/** Supports a leading `@` (articles only) or `#` (templates only) prefix,
 * per Step 6's spec -- stripped before the real Fuse query runs. */
export function search(query: string, options: KbSearchOptions = {}): KbSearchResult[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const prefixChar = trimmed[0]
  const prefixFilter = TYPE_PREFIXES.get(prefixChar)
  const effectiveQuery = prefixFilter ? trimmed.slice(1).trim() : trimmed
  if (!effectiveQuery) return []

  const fuse = getFuse()
  const raw = fuse.search(effectiveQuery)

  const results: KbSearchResult[] = []
  for (const r of raw) {
    if (prefixFilter && !prefixFilter(r.item.article)) continue
    if (options.filter && !options.filter(r.item.article)) continue
    results.push({
      article: r.item.article,
      score: r.score ?? 1,
      matches: r.matches ?? [],
    })
    if (options.limit && results.length >= options.limit) break
  }
  return results
}

/** Whether a query's result count should be shown inline (≤ 5, per Step 6)
 * vs. routed to the full search page -- a pure function so the top-bar
 * search and the ⌘K palette both use the exact same threshold. */
export const INSTANT_RESULTS_LIMIT = 5

export function isInstantResultSet(results: KbSearchResult[]): boolean {
  return results.length > 0 && results.length <= INSTANT_RESULTS_LIMIT
}
