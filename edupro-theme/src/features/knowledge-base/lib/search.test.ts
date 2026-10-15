import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KbArticle, KbFrontmatter } from '@/features/knowledge-base/types/kb'

function makeArticle(overrides: Partial<KbFrontmatter> & { body?: string; excerpt?: string }): KbArticle {
  const { body = '', excerpt = '', ...fmOverrides } = overrides
  const frontmatter: KbFrontmatter = {
    title: 'Untitled',
    slug: 'untitled',
    section: '01-start-here',
    chapter: '01-welcome',
    audience: ['bursar'],
    article_type: 'long-form',
    read_time: 3,
    last_reviewed: '2026-09-19',
    reviewed_by: 'Test',
    current_as_of: '2026-09-19',
    version: 1,
    legal_references: [],
    tags: [],
    related: [],
    featured: false,
    draft: false,
    ...fmOverrides,
  }
  return {
    frontmatter,
    path: `/src/content/knowledge-base/${frontmatter.section}/${frontmatter.chapter}/${frontmatter.slug}.mdx`,
    sectionId: frontmatter.section,
    chapterId: frontmatter.chapter,
    excerpt,
    body,
    computedReadTimeMinutes: frontmatter.read_time,
  }
}

const fixtureArticles: KbArticle[] = [
  makeArticle({
    slug: 'how-to-do-a-cash-up',
    title: 'How to Do a Cash Up',
    article_type: 'step-by-step',
    tags: ['cash-up', 'receipting'],
    body: 'Steps for reconciling the cash office drawer at end of day.',
  }),
  makeArticle({
    slug: 'requisition-form',
    title: 'Requisition Form',
    article_type: 'template',
    tags: ['procurement'],
    body: 'A blank requisition form template for raising a purchase request.',
  }),
  makeArticle({
    slug: 'draft-article',
    title: 'Draft Cash Handling Notes',
    draft: true,
    body: 'Should never appear in search results.',
  }),
]

vi.mock('./content-loader', () => ({
  getAllArticles: () => fixtureArticles,
  getSection: () => undefined,
  getChapter: () => undefined,
}))

const { search, rebuildSearchIndex, isInstantResultSet, INSTANT_RESULTS_LIMIT } = await import('./search')

beforeEach(() => {
  rebuildSearchIndex()
})

describe('search', () => {
  it('finds an article by a title/body keyword', () => {
    const results = search('cash up')
    expect(results.map((r) => r.article.frontmatter.slug)).toContain('how-to-do-a-cash-up')
  })

  it('never returns draft articles', () => {
    const results = search('cash')
    expect(results.some((r) => r.article.frontmatter.draft)).toBe(false)
  })

  it('returns nothing for an empty query', () => {
    expect(search('')).toEqual([])
    expect(search('   ')).toEqual([])
  })

  it('"#" prefix restricts results to templates', () => {
    const results = search('#form')
    expect(results.every((r) => r.article.frontmatter.article_type === 'template')).toBe(true)
    expect(results.map((r) => r.article.frontmatter.slug)).toContain('requisition-form')
  })

  it('"@" prefix excludes templates', () => {
    const results = search('@cash')
    expect(results.every((r) => r.article.frontmatter.article_type !== 'template')).toBe(true)
  })

  it('respects an explicit filter predicate', () => {
    const results = search('cash', { filter: (a) => a.frontmatter.slug === 'requisition-form' })
    expect(results).toEqual([])
  })

  it('respects a result limit', () => {
    const results = search('a', { limit: 1 })
    expect(results.length).toBeLessThanOrEqual(1)
  })
})

describe('isInstantResultSet', () => {
  it('is false for zero results', () => {
    expect(isInstantResultSet([])).toBe(false)
  })

  it('is true up to the instant-results limit', () => {
    const fake = Array.from({ length: INSTANT_RESULTS_LIMIT }, () => ({ article: fixtureArticles[0], score: 0, matches: [] }))
    expect(isInstantResultSet(fake)).toBe(true)
  })

  it('is false beyond the instant-results limit', () => {
    const fake = Array.from({ length: INSTANT_RESULTS_LIMIT + 1 }, () => ({ article: fixtureArticles[0], score: 0, matches: [] }))
    expect(isInstantResultSet(fake)).toBe(false)
  })
})
