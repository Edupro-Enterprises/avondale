import type { KbArticle, KbArticleType, KbAudienceTag, KbSchoolType, KbSchoolLevel } from '@/features/knowledge-base/types/kb'

export interface KbFilterState {
  audience: KbAudienceTag[]
  article_type: KbArticleType[]
  school_type: KbSchoolType[]
  school_level: KbSchoolLevel[]
  tags: string[]
}

export const EMPTY_KB_FILTERS: KbFilterState = {
  audience: [],
  article_type: [],
  school_type: [],
  school_level: [],
  tags: [],
}

export function hasActiveKbFilters(filters: KbFilterState): boolean {
  return Object.values(filters).some((values) => values.length > 0)
}

/** An article matches a filter group if it has no value for that field
 * (unset = applies to everyone) or shares at least one value with the
 * selected filter options; groups combine with AND, options within a
 * group combine with OR. Draft articles never match once any filter is
 * active -- list/search pages show drafts only via getAllArticles() directly. */
export function matchesKbFilters(article: KbArticle, filters: KbFilterState): boolean {
  const fm = article.frontmatter
  if (fm.draft && hasActiveKbFilters(filters)) return false

  if (filters.audience.length > 0 && !fm.audience.some((a) => filters.audience.includes(a))) {
    return false
  }
  if (filters.article_type.length > 0 && !filters.article_type.includes(fm.article_type)) {
    return false
  }
  if (
    filters.school_type.length > 0 &&
    fm.school_type &&
    !fm.school_type.some((t) => filters.school_type.includes(t))
  ) {
    return false
  }
  if (
    filters.school_level.length > 0 &&
    fm.school_level &&
    !fm.school_level.some((l) => filters.school_level.includes(l))
  ) {
    return false
  }
  if (filters.tags.length > 0 && !fm.tags.some((t) => filters.tags.includes(t))) {
    return false
  }
  return true
}

export function filterKbArticles(articles: KbArticle[], filters: KbFilterState): KbArticle[] {
  return articles.filter((article) => matchesKbFilters(article, filters))
}
