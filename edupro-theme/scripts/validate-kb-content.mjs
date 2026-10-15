#!/usr/bin/env node
/** Build-time content validation for the knowledge base.
 *
 * Runs the *real* content-loader.ts through Vite's SSR pipeline (so it
 * resolves the same virtual:kb-content-index module dev/build use) rather
 * than reimplementing frontmatter/structure validation here -- one
 * validator, not two that can drift apart. content-loader.ts already
 * throws on bad frontmatter, duplicate slugs, and section/chapter
 * mismatches just by being imported (see its own docstring); this script
 * additionally checks the one thing content-loader deliberately does NOT
 * fail on at runtime: a `related` slug that doesn't resolve to a real
 * article (getRelatedArticles silently drops those so a bad reference
 * never crashes a reader's page, but a content author should still hear
 * about it before it ships). */
import { createServer } from 'vite'

async function main() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })

  const errors = []

  try {
    const loader = await server.ssrLoadModule('/src/features/knowledge-base/lib/content-loader.ts')
    const articles = loader.getAllArticles()

    if (articles.length === 0) {
      console.warn('No knowledge-base articles found -- nothing to validate.')
    }

    const slugs = new Set(articles.map((a) => a.frontmatter.slug))
    for (const article of articles) {
      for (const relatedSlug of article.frontmatter.related) {
        if (!slugs.has(relatedSlug)) {
          errors.push(`${article.path}: related slug "${relatedSlug}" does not match any known article.`)
        }
      }
    }

    console.log(`Validated ${articles.length} article(s) across ${loader.getSections().length} section(s).`)
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
  } finally {
    await server.close()
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} content validation error(s):\n`)
    for (const e of errors) console.error(`  - ${e}`)
    process.exitCode = 1
    return
  }

  console.log('Knowledge base content is valid.')
}

main()
