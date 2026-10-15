/** Shared types for the knowledge base. Controlled vocabularies live here
 * (not scattered across schema/roles/filters) so content-schema.ts,
 * roles.ts, and filters.ts all validate against the exact same lists. */

/** The 7 stakeholder roles the KB has a landing page for, plus the
 * unauthenticated default. "mopse" reuses the app's real "District
 * Education Auditor/Inspector" role for auth purposes (no separate MoPSE
 * login exists in Edupro) but is kept as its own KB persona since a MoPSE
 * officer's reading list differs from a school-appointed auditor's. */
export const KB_ROLES = [
  'parent',
  'sdc',
  'bursar',
  'head',
  'auditor',
  'mopse',
  'student',
  'public',
] as const
export type KbRole = (typeof KB_ROLES)[number]

/** Frontmatter `audience` is deliberately a superset of KB_ROLES -- an
 * article can target a persona ("cashier") that doesn't get its own
 * sidebar/landing page but still needs precise audience filtering. */
export const KB_AUDIENCE_TAGS = [
  'parent',
  'sdc',
  'bursar',
  'cashier',
  'head',
  'auditor',
  'mopse',
  'student',
] as const
export type KbAudienceTag = (typeof KB_AUDIENCE_TAGS)[number]

export const KB_ARTICLE_TYPES = [
  'long-form',
  'quick-read',
  'step-by-step',
  'checklist',
  'template',
  'case-study',
  'faq',
  'reference',
] as const
export type KbArticleType = (typeof KB_ARTICLE_TYPES)[number]

export const KB_SCHOOL_TYPES = ['government', 'mission', 'private', 'trust', 'all'] as const
export type KbSchoolType = (typeof KB_SCHOOL_TYPES)[number]

export const KB_SCHOOL_LEVELS = ['primary', 'secondary', 'both'] as const
export type KbSchoolLevel = (typeof KB_SCHOOL_LEVELS)[number]

export const KB_ARTICLE_STATUS = ['current', 'superseded', 'draft'] as const
export type KbArticleStatus = (typeof KB_ARTICLE_STATUS)[number]

/** The controlled list of legal instruments an article may cite --
 * content-schema.ts rejects any legal_references entry not drawn from
 * here, so a typo'd or invented citation fails the build instead of
 * quietly shipping. Content authors extend this list deliberately (a
 * one-line PR), they never free-type a new instrument inline. */
export const KB_LEGAL_INSTRUMENTS = [
  'Education Act [Chapter 25:04]',
  'Education (General) Regulations, 2025',
  'Public Finance Management Act [Chapter 22:19]',
  'Public Finance Management (General) Regulations, 2019',
  'Procurement Act [Chapter 22:14]',
  'School Development Committee Regulations',
] as const
export type KbLegalInstrument = (typeof KB_LEGAL_INSTRUMENTS)[number]

export interface KbFrontmatter {
  title: string
  slug: string
  section: string
  chapter: string
  audience: KbAudienceTag[]
  article_type: KbArticleType
  read_time: number
  last_reviewed: string
  reviewed_by: string
  current_as_of: string
  version: number
  legal_references: KbLegalInstrument[]
  tags: string[]
  related: string[]
  featured: boolean
  draft: boolean
  school_type?: KbSchoolType[]
  school_level?: KbSchoolLevel[]
  status?: KbArticleStatus
  summary?: string
}

export interface KbArticle {
  frontmatter: KbFrontmatter
  /** Path relative to src/content/knowledge-base, e.g.
   * "05-getting-money-in/02-receipting/01-how-to-issue-official-receipt.mdx" */
  path: string
  /** Lazy-loaded MDX component import -- see content-loader.ts's
   * getArticleComponent(). Not resolved eagerly; only metadata is. */
  sectionId: string
  chapterId: string
  /** First ~300 chars of the raw MDX body, stripped of markdown syntax --
   * used for list-page/search-result excerpts. */
  excerpt: string
  /** The full article body, stripped of markdown/JSX syntax -- used only
   * for search indexing (search.ts), never rendered directly. */
  body: string
  /** reading-time's own estimate, rounded up to whole minutes -- shown
   * alongside (not instead of) frontmatter.read_time so an author's
   * declared figure and a mechanical estimate can be compared; a large gap
   * is worth a second look during review, not silently ignored. */
  computedReadTimeMinutes: number
}

export interface KbMeta {
  title: string
  description: string
  order: number
  audience?: KbAudienceTag[]
  icon?: string
}

export interface KbChapter {
  id: string
  sectionId: string
  meta: KbMeta
  articles: KbArticle[]
}

export interface KbSection {
  id: string
  meta: KbMeta
  chapters: KbChapter[]
}
