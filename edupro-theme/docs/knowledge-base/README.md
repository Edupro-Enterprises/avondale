# Knowledge Base

An in-app help centre at `/help`, covering financial management for Zimbabwean schools. Reachable by any signed-in role (see [`src/lib/frappe/route-guard.ts`](../../src/lib/frappe/route-guard.ts)'s `requireAnyAuth`), not scoped to one role shell the way Bursar/SDC/etc. are.

## Status

Scaffolded across phases 1a–1e. **Content is placeholder-only** — every article currently in the repo is `draft: true` and says so in its own body. Real content is blocked on two source documents (*Financial Management in Zimbabwean Government Schools*; the SDC Finance Sub-Committee short answer) that haven't been supplied yet.

| Phase | What it covers | Status |
|---|---|---|
| 1a | Content schema (zod), content loader, search index (Fuse.js), filters | Done |
| 1b | Shell (sidebar/header/TOC), 12-block article template, 13 MDX components | Done |
| 1c | 7 role landing pages + public, search UI, filter bar, templates/FAQ/glossary/acronyms pages | Done |
| 1d | Favourites/recent/progress, feedback, comments, analytics (all local-only), print styles, deep-links infrastructure | Done |
| 1e | Build-time content validation, more unit tests, this doc, 10 placeholder reference articles | Done |
| 2 | Real backend (Frappe DocTypes + API) for feedback/comments/progress/analytics sync | Not started |
| 3 | PWA/offline caching, deep-link icons rolled out to existing Bursar/SDC/Head/etc. screens, real article content | Not started |

## Where things live

```
src/content/knowledge-base/          content (11 sections, one chapter each today)
src/features/knowledge-base/
  types/kb.ts                        controlled vocabularies + KbFrontmatter/KbArticle types
  lib/content-schema.ts              zod validation for frontmatter + _meta.json
  lib/content-loader.ts              builds the in-memory section→chapter→article tree
  lib/search.ts                      Fuse.js full-text search
  lib/filters.ts                     audience/type/school filter predicates
  lib/kb-sidebar-data.ts             content tree → the app's normal SidebarData shape
  lib/role-landing-config.ts         per-role landing page copy
  lib/deep-links.ts                  context-key → article lookup (not yet wired into any screen)
  components/                        shell pieces (article template, TOC, filter bar, comments…)
  components/mdx/                    the 13 components MDX content can use
  stores/                            local-first zustand stores (library/feedback/comments/analytics)
  hooks/use-kb-filters.ts
src/routes/help/                     all KB pages
vite-plugin-kb-content.ts            repo-root Vite plugin; see architecture.md for why it exists
scripts/validate-kb-content.mjs      build-time content validation (npm run validate:kb)
```

See [`content-authoring.md`](./content-authoring.md) to write an article, and [`architecture.md`](./architecture.md) for how the content pipeline actually works and the gotchas it works around.

## Commands

```bash
npm run validate:kb   # validate every article's frontmatter + structure (also runs as part of `npm run build`)
npm test -- src/features/knowledge-base   # KB unit tests
```
