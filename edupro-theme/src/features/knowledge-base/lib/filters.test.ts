import { describe, expect, it } from 'vitest'
import { EMPTY_KB_FILTERS, filterKbArticles, hasActiveKbFilters, matchesKbFilters, type KbFilterState } from './filters'
import type { KbArticle, KbFrontmatter } from '@/features/knowledge-base/types/kb'

function makeArticle(overrides: Partial<KbFrontmatter>): KbArticle {
  const frontmatter: KbFrontmatter = {
    title: 'Test Article',
    slug: 'test-article',
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
    ...overrides,
  }
  return {
    frontmatter,
    path: `/src/content/knowledge-base/${frontmatter.section}/${frontmatter.chapter}/${frontmatter.slug}.mdx`,
    sectionId: frontmatter.section,
    chapterId: frontmatter.chapter,
    excerpt: '',
    body: '',
    computedReadTimeMinutes: frontmatter.read_time,
  }
}

describe('hasActiveKbFilters', () => {
  it('is false for the empty filter state', () => {
    expect(hasActiveKbFilters(EMPTY_KB_FILTERS)).toBe(false)
  })

  it('is true once any dimension has a value', () => {
    expect(hasActiveKbFilters({ ...EMPTY_KB_FILTERS, audience: ['parent'] })).toBe(true)
  })
})

describe('matchesKbFilters', () => {
  it('matches everything when no filters are active, except drafts', () => {
    const article = makeArticle({})
    expect(matchesKbFilters(article, EMPTY_KB_FILTERS)).toBe(true)

    const draft = makeArticle({ draft: true })
    expect(matchesKbFilters(draft, EMPTY_KB_FILTERS)).toBe(true) // no active filter -> even drafts pass
  })

  it('excludes drafts once any filter is active', () => {
    const draft = makeArticle({ draft: true, audience: ['bursar'] })
    const filters: KbFilterState = { ...EMPTY_KB_FILTERS, audience: ['bursar'] }
    expect(matchesKbFilters(draft, filters)).toBe(false)
  })

  it('audience filter is OR within the group', () => {
    const article = makeArticle({ audience: ['parent', 'student'] })
    const filters: KbFilterState = { ...EMPTY_KB_FILTERS, audience: ['bursar', 'student'] }
    expect(matchesKbFilters(article, filters)).toBe(true)
  })

  it('article_type filter rejects a non-matching type', () => {
    const article = makeArticle({ article_type: 'checklist' })
    const filters: KbFilterState = { ...EMPTY_KB_FILTERS, article_type: ['template'] }
    expect(matchesKbFilters(article, filters)).toBe(false)
  })

  it('school_type/school_level filters pass an article that declares neither', () => {
    const article = makeArticle({})
    const filters: KbFilterState = { ...EMPTY_KB_FILTERS, school_type: ['government'] }
    expect(matchesKbFilters(article, filters)).toBe(true)
  })

  it('multiple active groups combine with AND', () => {
    const article = makeArticle({ audience: ['bursar'], article_type: 'checklist' })
    const filters: KbFilterState = { ...EMPTY_KB_FILTERS, audience: ['bursar'], article_type: ['template'] }
    expect(matchesKbFilters(article, filters)).toBe(false)
  })
})

describe('filterKbArticles', () => {
  it('filters a list down to matching articles only', () => {
    const articles = [
      makeArticle({ slug: 'a', audience: ['bursar'] }),
      makeArticle({ slug: 'b', audience: ['parent'] }),
    ]
    const filters: KbFilterState = { ...EMPTY_KB_FILTERS, audience: ['parent'] }
    const result = filterKbArticles(articles, filters)
    expect(result.map((a) => a.frontmatter.slug)).toEqual(['b'])
  })
})
