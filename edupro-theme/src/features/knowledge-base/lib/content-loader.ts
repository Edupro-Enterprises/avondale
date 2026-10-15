/** Loads and indexes every knowledge-base article + _meta.json into an
 * in-memory Section -> Chapter -> Article tree, once, at module load.
 *
 * Metadata (frontmatter, _meta.json, plain-text body) comes from the
 * `virtual:kb-content-index` module -- generated server-side by
 * vite-plugin-kb-content.ts, not parsed here. See that file for why: the
 * more obvious `import.meta.glob(..., { query: '?raw' })` + gray-matter
 * approach doesn't work once @mdx-js/rollup is also registered, since its
 * transform hook strips query strings before filtering and unconditionally
 * MDX-compiles every `.mdx`-pathed request, clobbering the raw string.
 *
 * The actual compiled MDX React component is still loaded lazily, for
 * real, via import.meta.glob below -- only fetched when an article is
 * actually opened (getArticleComponent()). Loading every article's
 * compiled component eagerly would pull the whole knowledge base into the
 * initial bundle. */
import readingTime from 'reading-time/lib/reading-time'
import type { ComponentType } from 'react'
import { kbMetas, kbArticles } from 'virtual:kb-content-index'
import { parseKbFrontmatter, kbMetaSchema } from './content-schema'
import type { KbArticle, KbChapter, KbSection, KbFrontmatter } from '@/features/knowledge-base/types/kb'

const CONTENT_ROOT = '/src/content/knowledge-base/'

const articleComponentLoaders = import.meta.glob('/src/content/knowledge-base/**/*.mdx') as Record<
  string,
  () => Promise<{ default: ComponentType; frontmatter?: unknown }>
>

function stripToPlainText(body: string): string {
  return body
    .replace(/^import .+$/gm, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_>`~[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function excerptFrom(plain: string, maxLen = 300): string {
  return plain.length > maxLen ? `${plain.slice(0, maxLen).trimEnd()}…` : plain
}

function parsePathParts(path: string): string[] {
  return path.slice(CONTENT_ROOT.length).split('/')
}

interface KbTree {
  sections: KbSection[]
  sectionsById: Map<string, KbSection>
  chaptersById: Map<string, KbChapter> // keyed "sectionId/chapterId"
  articlesBySlug: Map<string, KbArticle>
  allArticles: KbArticle[]
}

let cachedTree: KbTree | null = null

function buildTree(): KbTree {
  const sectionsById = new Map<string, KbSection>()
  const chaptersById = new Map<string, KbChapter>()

  // Pass 1: sections ("<sectionId>/_meta.json").
  // Two passes, not one, because a chapter's _meta.json can sort before its
  // section's own _meta.json alphabetically ("02-x/_meta.json" < "_meta.json"
  // as strings) -- building sections first means a chapter never has to
  // guess at or overwrite a section it hasn't seen yet.
  for (const { relPath, data } of kbMetas) {
    const parts = relPath.split('/')
    if (parts.length !== 2) continue
    const [sectionId] = parts
    const meta = kbMetaSchema.parse(data)
    sectionsById.set(sectionId, { id: sectionId, meta, chapters: [] })
  }

  // Pass 2: chapters ("<sectionId>/<chapterId>/_meta.json").
  for (const { relPath, data } of kbMetas) {
    const parts = relPath.split('/')
    if (parts.length !== 3) continue
    const [sectionId, chapterId] = parts
    const section = sectionsById.get(sectionId)
    if (!section) {
      throw new Error(
        `Content structure error: chapter "${chapterId}" (${relPath}) has no matching section "${sectionId}/_meta.json".`
      )
    }
    const meta = kbMetaSchema.parse(data)
    const chapter: KbChapter = { id: chapterId, sectionId, meta, articles: [] }
    chaptersById.set(`${sectionId}/${chapterId}`, chapter)
    section.chapters.push(chapter)
  }

  // Pass 3: articles.
  const articlesBySlug = new Map<string, KbArticle>()
  const allArticles: KbArticle[] = []

  for (const { path, frontmatter: rawFrontmatter, body: content } of kbArticles) {
    const parts = parsePathParts(path)
    if (parts.length !== 3) {
      throw new Error(
        `Content structure error: "${path}" must be nested exactly <section>/<chapter>/<file>.mdx.`
      )
    }
    const [sectionId, chapterId] = parts
    const frontmatter = parseKbFrontmatter(path, rawFrontmatter) as KbFrontmatter

    if (frontmatter.section !== sectionId) {
      throw new Error(
        `Content structure error: ${path} has frontmatter.section="${frontmatter.section}" but lives under "${sectionId}".`
      )
    }
    if (frontmatter.chapter !== chapterId) {
      throw new Error(
        `Content structure error: ${path} has frontmatter.chapter="${frontmatter.chapter}" but lives under "${chapterId}".`
      )
    }

    const chapter = chaptersById.get(`${sectionId}/${chapterId}`)
    if (!chapter) {
      throw new Error(
        `Content structure error: ${path} has no matching "${sectionId}/${chapterId}/_meta.json".`
      )
    }

    if (articlesBySlug.has(frontmatter.slug)) {
      throw new Error(
        `Content structure error: duplicate slug "${frontmatter.slug}" (${path} and an earlier article both use it). Slugs must be unique across the whole knowledge base.`
      )
    }

    const plainBody = stripToPlainText(content)
    // frontmatter.read_time is author-declared and what's actually
    // displayed (an author may reasonably adjust it for a reader skimming
    // steps rather than reading every word) -- the mechanical estimate is
    // exposed alongside it for review tooling to flag a large gap, not to
    // override the author's figure.
    const computedReadTimeMinutes = Math.max(1, Math.ceil(readingTime(plainBody).minutes))

    const article: KbArticle = {
      frontmatter,
      path,
      sectionId,
      chapterId,
      excerpt: frontmatter.summary ?? excerptFrom(plainBody),
      body: plainBody,
      computedReadTimeMinutes,
    }

    chapter.articles.push(article)
    articlesBySlug.set(frontmatter.slug, article)
    allArticles.push(article)
  }

  // Sort everything by declared _meta.json order / article filename order.
  const sections = Array.from(sectionsById.values()).sort((a, b) => a.meta.order - b.meta.order)
  for (const section of sections) {
    section.chapters.sort((a, b) => a.meta.order - b.meta.order)
    for (const chapter of section.chapters) {
      chapter.articles.sort((a, b) => a.path.localeCompare(b.path))
    }
  }

  return { sections, sectionsById, chaptersById, articlesBySlug, allArticles }
}

function tree(): KbTree {
  if (!cachedTree) cachedTree = buildTree()
  return cachedTree
}

export function getSections(): KbSection[] {
  return tree().sections
}

export function getSection(sectionId: string): KbSection | undefined {
  return tree().sectionsById.get(sectionId)
}

export function getChapters(sectionId: string): KbChapter[] {
  return getSection(sectionId)?.chapters ?? []
}

export function getChapter(sectionId: string, chapterId: string): KbChapter | undefined {
  return tree().chaptersById.get(`${sectionId}/${chapterId}`)
}

export function getArticles(sectionId: string, chapterId: string): KbArticle[] {
  return getChapter(sectionId, chapterId)?.articles ?? []
}

export function getArticle(sectionId: string, chapterId: string, slug: string): KbArticle | undefined {
  const article = tree().articlesBySlug.get(slug)
  return article && article.sectionId === sectionId && article.chapterId === chapterId ? article : undefined
}

export function getArticleBySlug(slug: string): KbArticle | undefined {
  return tree().articlesBySlug.get(slug)
}

export function getAllArticles(): KbArticle[] {
  return tree().allArticles
}

/** Resolves the related-article slugs on an article to real KbArticle
 * objects, silently dropping any that don't resolve -- content-validation
 * (a separate, build-time-only script) is what fails the build on a dead
 * related-slug; this runtime helper just needs to not crash a page over it. */
export function getRelatedArticles(article: KbArticle): KbArticle[] {
  return article.frontmatter.related
    .map((slug) => getArticleBySlug(slug))
    .filter((a): a is KbArticle => a !== undefined)
}

/** Lazily fetches the compiled MDX component for one article -- call this
 * from the article page's data loader, not eagerly. */
export async function getArticleComponent(
  article: KbArticle
): Promise<{ Component: ComponentType; frontmatter: unknown }> {
  const loader = articleComponentLoaders[article.path]
  if (!loader) {
    throw new Error(`No MDX module registered for "${article.path}".`)
  }
  const mod = await loader()
  return { Component: mod.default, frontmatter: mod.frontmatter }
}

/** Exposed for content-validation's build-time script and for tests --
 * everything above is the real, cached, app-facing API. */
export function __resetKbContentCacheForTests(): void {
  cachedTree = null
}
