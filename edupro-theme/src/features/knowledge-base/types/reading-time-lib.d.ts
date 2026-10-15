/** reading-time's package root (`reading-time`) re-exports a Node-stream
 * variant that references `util.inherits`, which doesn't exist in a
 * browser runtime -- confirmed live, it crashes Vitest's browser-mode test
 * environment on import. content-loader.ts imports the pure, browser-safe
 * core function directly from this subpath instead, which has no
 * published types of its own. */
declare module 'reading-time/lib/reading-time' {
  export interface ReadingTimeStats {
    text: string
    minutes: number
    time: number
    words: number
  }

  export default function readingTime(text: string): ReadingTimeStats
}
