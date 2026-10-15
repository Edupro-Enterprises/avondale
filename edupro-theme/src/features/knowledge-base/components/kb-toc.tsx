import { useEffect, useState, type RefObject } from 'react'
import { cn } from '@/lib/utils'

interface TocEntry {
  id: string
  text: string
  level: number
}

/** Reads the rendered article body for h2/h3s (rehype-slug already gives
 * each one an id) instead of parsing MDX source -- the DOM is the one
 * source of truth for "what heading actually rendered", no separate
 * heading-extraction pass to keep in sync with the MDX pipeline. */
export function KbToc({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const [entries, setEntries] = useState<TocEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const headings = Array.from(container.querySelectorAll('h2[id], h3[id]'))
    setEntries(
      headings.map((h) => ({
        id: h.id,
        text: h.textContent ?? '',
        level: h.tagName === 'H3' ? 3 : 2,
      }))
    )

    const observer = new IntersectionObserver(
      (observedEntries) => {
        const visible = observedEntries.find((e) => e.isIntersecting)
        if (visible) setActiveId(visible.target.id)
      },
      { rootMargin: '0px 0px -70% 0px' }
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [containerRef])

  if (entries.length < 2) return null

  return (
    <nav aria-label='On this page' className='sticky top-20 hidden max-h-[calc(100vh-6rem)] w-56 shrink-0 overflow-y-auto text-sm lg:block'>
      <p className='mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>On this page</p>
      <ul className='space-y-1 border-l'>
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className={cn(
                'block border-l-2 py-1 pl-3 -ml-px text-muted-foreground hover:text-foreground',
                entry.level === 3 && 'pl-6',
                activeId === entry.id ? 'border-primary text-foreground font-medium' : 'border-transparent'
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
