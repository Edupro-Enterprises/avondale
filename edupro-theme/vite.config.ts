/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { playwright } from '@vitest/browser-playwright'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import { kbContentIndexPlugin } from './vite-plugin-kb-content'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // No staging exists yet -- local dev proxies straight to production so
  // the browser sees same-origin requests (matching prod's own Traefik
  // PathPrefix setup) instead of hitting Frappe's CORS wall. Set
  // VITE_FRAPPE_URL in .env.local (gitignored) to the real backend URL;
  // unset, the proxy is a no-op and API calls just 404 locally.
  const frappeTarget = env.VITE_FRAPPE_URL
  return {
    // Production shares fees.edupro.co.zw with Frappe via Traefik
    // PathPrefix (see the backend's ADR 0006): Frappe's own router claims
    // /app, /api, /assets, /files, /private, /socket.io at higher
    // priority than this app's catch-all. Vite's default build.assetsDir
    // is "assets", which would collide -- every JS/CSS bundle would
    // route to Frappe (404) instead of this app's static server.
    // theme-assets avoids every reserved prefix.
    build: {
      assetsDir: 'theme-assets',
    },
    server: {
      host: true,
      proxy: frappeTarget
        ? {
            '/api': { target: frappeTarget, changeOrigin: true },
            '/app': { target: frappeTarget, changeOrigin: true },
            '/assets': { target: frappeTarget, changeOrigin: true },
            '/files': { target: frappeTarget, changeOrigin: true },
            '/private': { target: frappeTarget, changeOrigin: true },
          }
        : undefined,
    },
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
      }),
      // Server-side frontmatter/meta parsing for the knowledge base -- see
      // vite-plugin-kb-content.ts for why this can't just be a raw
      // import.meta.glob() read in content-loader.ts.
      kbContentIndexPlugin(),
      // Knowledge base content: exported `frontmatter` per remark-mdx-frontmatter,
      // heading anchors + auto-links, and syntax highlighting for the rare
      // code block a procedure article needs. Placed before react() so its
      // JSX output (jsxImportSource: 'react') is what react() then transforms.
      mdx({
        jsxImportSource: 'react',
        remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'wrap' }],
          [rehypePrettyCode, { theme: { dark: 'github-dark', light: 'github-light' } }],
        ],
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      silent: 'passed-only',
      unstubEnvs: true,
      // e2e/**/*.spec.ts are Playwright specs run only via `npm run test:e2e`
      // -- without this, vitest's default include picks them up too and
      // crashes importing @playwright/test under its own browser-mode
      // transform ("Cannot read properties of undefined (reading 'node')").
      exclude: ['e2e/**', 'node_modules/**'],
      browser: {
        enabled: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
      coverage: {
        // include: ['src/**/*.{js,jsx,ts,tsx}'], // Uncomment to expand the report to all src/**/* so untested modules appear as 0% coverage.
        exclude: [
          'src/components/ui/**',
          'src/assets/**',
          'src/tanstack-table.d.ts',
          'src/routeTree.gen.ts',
          'src/test-utils/**',
          'src/routes/**',
        ],
      },
    },
  };
});

