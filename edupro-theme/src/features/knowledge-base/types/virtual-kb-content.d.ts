/** Ambient types for the virtual module vite-plugin-kb-content.ts
 * generates -- see that file for why frontmatter parsing happens there
 * (server-side, once) instead of via a raw import.meta.glob in the
 * browser. */
declare module 'virtual:kb-content-index' {
  export interface KbContentIndexMeta {
    relPath: string
    data: unknown
  }

  export interface KbContentIndexArticle {
    path: string
    frontmatter: unknown
    body: string
  }

  export const kbMetas: KbContentIndexMeta[]
  export const kbArticles: KbContentIndexArticle[]
}
