import { useState } from 'react'
import { Filter, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { type FilterGroupDef, type useFilters } from '@/hooks/use-filters'

interface FilterBarProps {
  filters: ReturnType<typeof useFilters>
  groups: FilterGroupDef[]
  searchPlaceholder?: string
}

/** Shared search + composable-filter UI (AUD-019/021/022/023): a search
 * input, a drawer (built on the existing Sheet primitive) holding every
 * filter group plus saved views, and removable chips for whatever's active. */
export function FilterBar({ filters, groups, searchPlaceholder }: FilterBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative'>
          <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder={searchPlaceholder ?? 'Search…'}
            className='pl-8'
            value={filters.search}
            onChange={(e) => filters.setSearch(e.target.value)}
          />
        </div>
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Button variant='outline' onClick={() => setDrawerOpen(true)}>
            <Filter className='h-4 w-4' />
            Filters
            {filters.activeCount > 0 && (
              <Badge className='rounded-full px-1.5 py-0 text-xs'>{filters.activeCount}</Badge>
            )}
          </Button>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Combine any of these to narrow the list.</SheetDescription>
            </SheetHeader>
            <div className='flex flex-1 flex-col gap-5 overflow-y-auto px-4'>
              {groups.map((group) => (
                <div key={group.key}>
                  <p className='mb-2 text-xs font-medium text-muted-foreground'>{group.label}</p>
                  <div className='flex flex-wrap gap-1.5'>
                    {group.options.map((option) => (
                      <Button
                        key={option}
                        type='button'
                        size='sm'
                        variant={filters.values[group.key] === option ? 'default' : 'outline'}
                        onClick={() => filters.setValue(group.key, option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              <SavedViews filters={filters} />
            </div>
            <SheetFooter className='flex-row justify-between'>
              <Button variant='ghost' onClick={filters.clearAll}>
                Clear all
              </Button>
              <Button onClick={() => setDrawerOpen(false)}>Done</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {filters.chips.length > 0 && (
        <div className='flex flex-wrap items-center gap-1.5'>
          {filters.chips.map((chip) => (
            <button
              key={chip.key}
              type='button'
              onClick={() => filters.setValue(chip.key, null)}
              className='inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs hover:bg-accent'
            >
              {chip.label}
              <X className='h-3 w-3' />
            </button>
          ))}
          <button
            type='button'
            onClick={filters.clearAll}
            className='text-xs text-muted-foreground hover:text-foreground'
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

function SavedViews({ filters }: { filters: ReturnType<typeof useFilters> }) {
  const [name, setName] = useState('')

  return (
    <div className='border-t pt-4'>
      <p className='mb-2 text-xs font-medium text-muted-foreground'>Saved views</p>
      {filters.savedViews.length > 0 && (
        <div className='mb-3 flex flex-col gap-1'>
          {filters.savedViews.map((view) => (
            <div key={view.name} className='flex items-center justify-between gap-2'>
              <button
                type='button'
                onClick={() => filters.applyView(view)}
                className='flex-1 truncate rounded-md px-2 py-1 text-left text-sm hover:bg-accent'
              >
                {view.name}
              </button>
              <Button
                variant='ghost'
                size='icon'
                className='h-7 w-7'
                aria-label={`Delete saved view ${view.name}`}
                onClick={() => filters.deleteView(view.name)}
              >
                <X className='h-3.5 w-3.5' />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className='flex gap-2'>
        <Input
          placeholder='Name this view…'
          value={name}
          onChange={(e) => setName(e.target.value)}
          className='h-8 text-sm'
        />
        <Button
          size='sm'
          variant='outline'
          disabled={!name.trim()}
          onClick={() => {
            filters.saveView(name.trim())
            setName('')
          }}
        >
          Save
        </Button>
      </div>
    </div>
  )
}
