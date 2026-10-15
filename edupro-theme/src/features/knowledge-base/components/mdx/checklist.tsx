import { useState, type ReactNode } from 'react'
import { CheckSquare2, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Checklist({ children }: { children: ReactNode }) {
  return <ul className='my-4 space-y-2'>{children}</ul>
}

/** Purely a reading aid -- checked state resets on reload, no persistence.
 * Real progress tracking belongs to Phase 1d's localStorage-backed
 * favourites/progress work, not to a content component. */
export function ChecklistItem({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false)
  return (
    <li>
      <button
        type='button'
        onClick={() => setChecked((c) => !c)}
        className={cn('flex w-full items-start gap-2 text-left text-sm', checked && 'text-muted-foreground line-through')}
      >
        {checked ? <CheckSquare2 className='mt-0.5 size-4 shrink-0 text-primary' /> : <Square className='mt-0.5 size-4 shrink-0' />}
        <span>{children}</span>
      </button>
    </li>
  )
}
