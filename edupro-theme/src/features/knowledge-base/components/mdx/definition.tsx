import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Inline glossary term -- a dotted-underline word with its definition on
 * hover/focus. A full glossary page (Steps 1c+) will link back to these
 * same terms; for now this is the reading-time inline explainer. */
export function Definition({ term, children }: { term: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className='cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-4'>
          {term}
        </span>
      </TooltipTrigger>
      <TooltipContent className='max-w-xs text-sm'>{children}</TooltipContent>
    </Tooltip>
  )
}
