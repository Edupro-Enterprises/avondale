/** Generates a virtual module (`virtual:kb-content-index`) holding every
 * knowledge-base article's frontmatter/excerpt/body and every _meta.json,
 * pre-parsed server-side at Vite processing time.
 *
 * Why this exists instead of the more obvious `import.meta.glob(..., {
 * query: '?raw' })` + gray-matter-in-the-browser approach: confirmed live
 * that @mdx-js/rollup's `transform` hook strips the query string before
 * filtering (`const [path] = id.split('?')`), so it unconditionally
 * MDX-compiles *every* `.mdx`-pathed request -- including a `?raw` one --
 * clobbering the raw string Vite's own core `?raw` handling had already
 * produced. There is no `include`/`exclude` escape hatch for this, since
 * by the time the filter runs the query is already gone. A virtual module
 * never has a `.mdx` id at all, so the MDX plugin's filter never matches
 * it -- and as a side benefit, gray-matter/frontmatter parsing now happens
 * once, in Node, instead of shipping that parsing logic to every client. */
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import matter from 'gray-matter'

const VIRTUAL_ID = 'virtual:kb-content-index'
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`
// import.meta.dirname, not __dirname -- this repo's Vite config already
// warns that __dirname is unsupported by Vite's "native" config loader,
// planned to become the default.
const CONTENT_DIR = path.resolve(import.meta.dirname, 'src/content/knowledge-base')

export interface KbContentIndexMeta {
  /** Path relative to CONTENT_DIR, e.g. "05-getting-money-in/_meta.json" */
  relPath: string
  data: unknown
}

export interface KbContentIndexArticle {
  /** Path relative to CONTENT_DIR, matching content-loader.ts's KbArticle.path
   * convention (with a leading slash, matching import.meta.glob's own key
   * format) so the two data sources line up on the same identifier. */
  path: string
  frontmatter: unknown
  body: string
}

function walk(dir: string, relBase = ''): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  let files: string[] = []
  for (const entry of entries) {
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files = files.concat(walk(path.join(dir, entry.name), rel))
    } else {
      files.push(rel)
    }
  }
  return files
}

function buildIndex(): { metas: KbContentIndexMeta[]; articles: KbContentIndexArticle[] } {
  if (!fs.existsSync(CONTENT_DIR)) {
    return { metas: [], articles: [] }
  }

  const relFiles = walk(CONTENT_DIR)
  const metas: KbContentIndexMeta[] = []
  const articles: KbContentIndexArticle[] = []

  for (const relPath of relFiles) {
    const absPath = path.join(CONTENT_DIR, relPath)
    if (relPath.endsWith('_meta.json')) {
      const raw = fs.readFileSync(absPath, 'utf-8')
      metas.push({ relPath, data: JSON.parse(raw) })
    } else if (relPath.endsWith('.mdx')) {
      const raw = fs.readFileSync(absPath, 'utf-8')
      const { data, content } = matter(raw)
      articles.push({
        path: `/src/content/knowledge-base/${relPath}`,
        frontmatter: data,
        body: content,
      })
    }
  }

  return { metas, articles }
}

export function kbContentIndexPlugin(): Plugin {
  let watchedDir = CONTENT_DIR

  return {
    name: 'kb-content-index',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID
      return undefined
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return undefined
      const { metas, articles } = buildIndex()
      // JSON.stringify is safe here: frontmatter/meta are plain
      // JSON-sourced data (from _meta.json and gray-matter's YAML parse),
      // never contains functions or other non-serializable values.
      return `export const kbMetas = ${JSON.stringify(metas)};\nexport const kbArticles = ${JSON.stringify(articles)};\n`
    },
    configureServer(server) {
      // Any change under content/knowledge-base invalidates the virtual
      // module so dev picks up new/edited articles without a manual
      // restart -- content-loader.ts's own in-memory tree cache is
      // per-module-instance, so a Vite-triggered re-import naturally
      // rebuilds it too.
      server.watcher.add(watchedDir)
      server.watcher.on('all', (_event, changedPath) => {
        if (changedPath.startsWith(watchedDir)) {
          const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
      })
    },
    buildStart() {
      watchedDir = CONTENT_DIR
    },
  }
}
