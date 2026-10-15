# Knowledge Base — Architecture Notes

## Why a custom Vite plugin parses content, not a raw `import.meta.glob`

The obvious approach — `import.meta.glob('**/*.mdx', { query: '?raw' })` + parse frontmatter with `gray-matter` in the browser — doesn't work once `@mdx-js/rollup` is also registered in `vite.config.ts`. Its `transform` hook strips the query string before checking whether a file is `.mdx` (`id.split('?')[0]`), so it unconditionally MDX-compiles *every* `.mdx`-pathed request, including a `?raw` one, clobbering the raw string Vite's own `?raw` handling had already produced. There's no `include`/`exclude` escape hatch — by the time the filter runs, the query is already gone.

[`vite-plugin-kb-content.ts`](../../vite-plugin-kb-content.ts) (repo root) works around this with a **virtual module**: it walks `src/content/knowledge-base`, parses every `_meta.json` and every article's frontmatter with `gray-matter`, and exposes the result as `virtual:kb-content-index`. A virtual module never has a `.mdx` id, so the MDX plugin's filter never matches it. `content-loader.ts` imports metadata from there; the actual compiled MDX **component** is still loaded lazily and for real via `import.meta.glob` (untouched — that's a `.jsx`-producing compile, not a raw-string read, so the MDX plugin is supposed to touch it).

## The content tree

`content-loader.ts` builds an in-memory `sections → chapters → articles` tree once, at module load, from `virtual:kb-content-index`'s data. Three passes (sections, then chapters, then articles) rather than one, because a chapter's `_meta.json` can sort before its own section's `_meta.json` alphabetically — building sections first means a chapter never has to guess at a section it hasn't seen yet.

Every article's frontmatter is validated against the zod schema in `content-schema.ts` **eagerly**, on load — an invalid article throws immediately rather than shipping a broken page that only fails once a reader opens it. `scripts/validate-kb-content.mjs` (the `npm run validate:kb` / `npm run build` check) relies on exactly this: it loads `content-loader.ts` through Vite's SSR pipeline and treats any thrown error as a validation failure, rather than re-implementing validation a second time.

## Search

`search.ts` builds a Fuse.js index from every **non-draft** article (title/excerpt/tags/section/chapter/audience/body, weighted). Supports a leading `@` (exclude templates) or `#` (templates only) query prefix. The same `search()` call backs both the ⌘K command palette (see `command-menu.tsx`'s `isKb` branch, keyed by reference-equality against the `kbSidebarData` singleton) and the full `/help/search` page.

## Sidebar reuse

`kb-sidebar-data.ts` converts the content tree into the exact `SidebarData` shape every role shell already uses (`section → NavGroup`, `chapter → NavCollapsible`, `article → NavLink`). This means the KB gets the app's real collapsible sidebar, mobile drawer, breadcrumbs (`PageBreadcrumb`), and the existing ⌘K palette for free, instead of a parallel nav implementation. Sections/chapters with zero published (non-draft) articles are dropped from the sidebar entirely.

## Local-first features (Phase 1d)

Favourites, recently-viewed, reading progress, feedback votes, and comments are all `zustand`/`persist` stores under `stores/`, matching the app's existing `useSchoolBrandingStore` convention. None of this syncs anywhere — it's real, working, and scoped to the visitor's own browser, explicitly built this way so Phase 2 only has to swap the store's internals for a real API without touching the UI. Local analytics batching (`kb-analytics-store.ts`) works the same way: real events (article views, debounced searches, feedback votes) accumulate in a capped local buffer with nowhere to send yet.

## Deep links (infrastructure only)

`deep-links.ts` maps a stable "context key" to an article slug, meant for a future "?" help icon on existing Bursar/SDC/Head/etc. screens. The lookup function exists and is tested by nothing using it yet — rolling it out to real screens is Phase 3 work, once there's enough real content for the links to be worth adding.
