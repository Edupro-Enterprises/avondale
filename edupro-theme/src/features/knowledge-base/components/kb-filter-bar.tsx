import { ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { KbFilterState } from '@/features/knowledge-base/lib/filters'
import {
  KB_AUDIENCE_TAGS,
  KB_ARTICLE_TYPES,
  KB_SCHOOL_TYPES,
  KB_SCHOOL_LEVELS,
} from '@/features/knowledge-base/types/kb'

interface FilterGroup {
  key: keyof KbFilterState
  label: string
  options: readonly string[]
}

const GROUPS: FilterGroup[] = [
  { key: 'audience', label: 'Audience', options: KB_AUDIENCE_TAGS },
  { key: 'article_type', label: 'Type', options: KB_ARTICLE_TYPES },
  { key: 'school_type', label: 'School type', options: KB_SCHOOL_TYPES },
  { key: 'school_level', label: 'School level', options: KB_SCHOOL_LEVELS },
]

/** One popover per filter dimension rather than a full drawer -- compact
 * enough for the header/toolbar row on both desktop and mobile, so one
 * component covers both instead of a separate Sheet variant. */
export function KbFilterBar({
  filters,
  isActive,
  toggle,
  clear,
}: {
  filters: KbFilterState
  isActive: boolean
  toggle: <K extends keyof KbFilterState>(key: K, value: KbFilterState[K][number]) => void
  clear: () => void
}) {
  return (
    <div className='flex flex-wrap items-center gap-2'>
      {GROUPS.map((group) => {
        const active = filters[group.key] as string[]
        return (
          <Popover key={group.key}>
            <PopoverTrigger asChild>
              <Button variant='outline' size='sm' className='h-8'>
                {group.label}
                {active.length > 0 && (
                  <span className='ms-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground'>
                    {active.length}
                  </span>
                )}
                <ChevronDown className='size-3.5' />
              </Button>
            </PopoverTrigger>
            <PopoverContent align='start' className='w-56 p-2'>
              <div className='space-y-1'>
                {group.options.map((option) => (
                  <label key={option} className='flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm capitalize hover:bg-accent'>
                    <Checkbox
                      checked={active.includes(option)}
                      onCheckedChange={() => toggle(group.key, option)}
                    />
                    {option.replace('-', ' ')}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )
      })}
      {isActive && (
        <Button variant='ghost' size='sm' className='h-8 text-muted-foreground' onClick={clear}>
          <X className='size-3.5' />
          Clear filters
        </Button>
      )}
    </div>
  )
}
