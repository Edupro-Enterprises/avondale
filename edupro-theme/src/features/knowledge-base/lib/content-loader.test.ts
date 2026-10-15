import { describe, expect, it } from 'vitest'
import {
  getSections,
  getSection,
  getChapters,
  getArticles,
  getArticle,
  getArticleBySlug,
  getAllArticles,
  getArticleComponent,
  getRelatedArticles,
} from './content-loader'

describe('content-loader', () => {
  it('loads all 11 top-level sections in declared order', () => {
    const sections = getSections()
    expect(sections).toHaveLength(11)
    expect(sections[0].id).toBe('01-start-here')
    expect(sections[0].meta.title).toBe('Start Here')
    expect(sections[sections.length - 1].id).toBe('11-reference')
    // strictly increasing order
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i].meta.order).toBeGreaterThan(sections[i - 1].meta.order)
    }
  })

  it('resolves a single section by id', () => {
    const section = getSection('05-getting-money-in')
    expect(section?.meta.title).toBe('Getting Money In')
  })

  it('loads the seeded chapter under 01-start-here', () => {
    const chapters = getChapters('01-start-here')
    expect(chapters.map((c) => c.id)).toContain('01-welcome')
  })

  it('loads the seeded article with valid, coerced frontmatter', () => {
    const articles = getArticles('01-start-here', '01-welcome')
    expect(articles).toHaveLength(1)
    const [article] = articles
    expect(article.frontmatter.title).toBe('What Is Financial Management?')
    expect(article.frontmatter.slug).toBe('what-is-financial-management')
    expect(article.frontmatter.draft).toBe(true)
    expect(article.frontmatter.audience).toContain('parent')
    expect(article.excerpt.length).toBeGreaterThan(0)
    expect(article.body).toContain('placeholder')
  })

  it('getArticle resolves by section+chapter+slug, and rejects a mismatched chapter', () => {
    const found = getArticle('01-start-here', '01-welcome', 'what-is-financial-management')
    expect(found?.frontmatter.slug).toBe('what-is-financial-management')

    const mismatched = getArticle('01-start-here', 'wrong-chapter', 'what-is-financial-management')
    expect(mismatched).toBeUndefined()
  })

  it('getArticleBySlug and getAllArticles agree with each other', () => {
    const all = getAllArticles()
    expect(all.length).toBeGreaterThanOrEqual(1)
    const bySlug = getArticleBySlug('what-is-financial-management')
    expect(bySlug).toBeDefined()
    expect(all).toContain(bySlug)
  })

  it('getRelatedArticles returns an empty array for an article with no related slugs', () => {
    const article = getArticleBySlug('what-is-financial-management')!
    expect(getRelatedArticles(article)).toEqual([])
  })

  it('lazily compiles the real MDX component for an article', async () => {
    const article = getArticleBySlug('what-is-financial-management')!
    const { Component } = await getArticleComponent(article)
    expect(typeof Component).toBe('function')
  })
})
