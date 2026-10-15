import React, { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, Laptop, Moon, Sun } from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { sidebarData as bursarSidebarData } from './layout/data/sidebar-data'
import { type SidebarData } from './layout/types'
import { ScrollArea } from './ui/scroll-area'
import { useBursarSearchIndex } from '@/lib/search-index'
import { useRecentEntities } from '@/hooks/use-recent-entities'
import { kbSidebarData } from '@/features/knowledge-base/lib/kb-sidebar-data'
import { search as searchKbArticles, INSTANT_RESULTS_LIMIT } from '@/features/knowledge-base/lib/search'

interface CommandMenuProps {
  /** Falls back to the Bursar's nav only if no role-specific data was
   * passed in -- every real caller (SearchProvider) supplies its own. */
  sidebarData?: SidebarData
}

export function CommandMenu({ sidebarData = bursarSidebarData }: CommandMenuProps) {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const [search, setSearch] = useState('')
  const { recents, recordVisit } = useRecentEntities()

  // Entity search (AUD-025) is Bursar-specific -- students/invoices/receipts/
  // debtors/vouchers/assets are all Bursar-owned data, and routing another
  // role's ⌘K into Bursar-only routes would repeat the exact bug AUD-026
  // fixed for navigation. Reference-equality check against the shared
  // singleton import is enough to tell "this is really the Bursar's menu".
  const isBursar = sidebarData === bursarSidebarData
  const searchIndex = useBursarSearchIndex(isBursar)

  // Same reference-equality trick as isBursar -- the KB's ⌘K search needs
  // full-text article results (Fuse, over body/tags/section/chapter), not
  // just the nav-item title matching CommandInput already does for every
  // other role's sidebarData below.
  const isKb = sidebarData === kbSidebarData
  const kbResults = useMemo(
    () => (isKb && search.trim() ? searchKbArticles(search, { limit: INSTANT_RESULTS_LIMIT }) : []),
    [isKb, search]
  )

  // CommandMenu stays mounted while the dialog is closed (only Radix's own
  // open/closed state toggles), so a controlled search input needs its own
  // reset here -- otherwise the last typed query (and whatever it matched)
  // is still sitting there next time the palette opens, silently hiding
  // the empty-query Recent list behind a stale, non-empty `search`. Reset
  // during render (React's documented pattern for this) rather than in an
  // effect, which would fire an extra render after the dialog already closed.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) setSearch('')
  }

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  const entityGroups = useMemo(() => {
    const map = new Map<string, typeof searchIndex>()
    for (const entry of searchIndex) {
      map.set(entry.type, [...(map.get(entry.type) ?? []), entry])
    }
    return [...map.entries()]
  }, [searchIndex])

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Type a command or search...' value={search} onValueChange={setSearch} />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pe-1'>
          <CommandEmpty>No results found.</CommandEmpty>
          {!search.trim() && recents.length > 0 && (
            <CommandGroup heading='Recent'>
              {recents.map((r) => (
                <CommandItem
                  key={`recent-${r.type}-${r.id}`}
                  value={`recent-${r.label}`}
                  onSelect={() => runCommand(() => navigate({ to: r.route }))}
                >
                  <div className='flex size-4 items-center justify-center'>
                    <ArrowRight className='size-2 text-muted-foreground/80' />
                  </div>
                  {r.label} <span className='text-xs text-muted-foreground'>{r.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {search.trim() &&
            entityGroups.map(([type, entries]) => (
              <CommandGroup key={type} heading={type}>
                {entries.map((entry) => (
                  <CommandItem
                    key={`${entry.type}-${entry.id}`}
                    value={`${entry.label} ${entry.id}`}
                    onSelect={() => {
                      recordVisit(entry)
                      runCommand(() => navigate({ to: entry.route }))
                    }}
                  >
                    <div className='flex size-4 items-center justify-center'>
                      <ArrowRight className='size-2 text-muted-foreground/80' />
                    </div>
                    <div className='flex min-w-0 flex-1 flex-col'>
                      <span className='truncate'>{entry.label}</span>
                      <span className='truncate text-xs text-muted-foreground'>{entry.subtitle}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          {isKb && search.trim() && (
            <CommandGroup heading='Knowledge Base'>
              {kbResults.map(({ article }) => (
                <CommandItem
                  key={article.frontmatter.slug}
                  value={`kb-${article.frontmatter.slug}`}
                  onSelect={() =>
                    runCommand(() =>
                      navigate({
                        to: '/help/$sectionId/$chapterId/$slug',
                        params: { sectionId: article.sectionId, chapterId: article.chapterId, slug: article.frontmatter.slug },
                      })
                    )
                  }
                >
                  <div className='flex size-4 items-center justify-center'>
                    <ArrowRight className='size-2 text-muted-foreground/80' />
                  </div>
                  <div className='flex min-w-0 flex-1 flex-col'>
                    <span className='truncate'>{article.frontmatter.title}</span>
                    <span className='truncate text-xs text-muted-foreground'>{article.excerpt}</span>
                  </div>
                </CommandItem>
              ))}
              <CommandItem
                value={`kb-see-all-${search}`}
                onSelect={() =>
                  runCommand(() => navigate({ to: '/help/search', search: { q: search } }))
                }
              >
                <ArrowRight className='size-4' />
                See all results for "{search}"
              </CommandItem>
            </CommandGroup>
          )}
          {!isKb &&
            sidebarData.navGroups.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((navItem, i) => {
                if (navItem.url)
                  return (
                    <CommandItem
                      key={`${navItem.url}-${i}`}
                      value={navItem.title}
                      onSelect={() => {
                        runCommand(() => navigate({ to: navItem.url }))
                      }}
                    >
                      <div className='flex size-4 items-center justify-center'>
                        <ArrowRight className='size-2 text-muted-foreground/80' />
                      </div>
                      {navItem.title}
                    </CommandItem>
                  )

                return navItem.items?.map((subItem, i) => (
                  <CommandItem
                    key={`${navItem.title}-${subItem.url}-${i}`}
                    value={`${navItem.title}-${subItem.url}`}
                    onSelect={() => {
                      runCommand(() => navigate({ to: subItem.url }))
                    }}
                  >
                    <div className='flex size-4 items-center justify-center'>
                      <ArrowRight className='size-2 text-muted-foreground/80' />
                    </div>
                    {navItem.title} <ChevronRight /> {subItem.title}
                  </CommandItem>
                ))
              })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading='Theme'>
            <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
              <Sun /> <span>Light</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
              <Moon className='scale-90' />
              <span>Dark</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <Laptop />
              <span>System</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
