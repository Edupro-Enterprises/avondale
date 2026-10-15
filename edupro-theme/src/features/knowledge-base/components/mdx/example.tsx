import type { ReactNode } from 'react'
import { Calculator } from 'lucide-react'

/** A worked example (a calculation, a filled-in form, a sample scenario)
 * -- visually distinct from Callout since it's illustrative, not a
 * warning/tip. */
export function Example({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className='my-4 rounded-lg border bg-muted/40 px-4 py-3 text-sm'>
      <p className='mb-2 flex items-center gap-2 font-semibold'>
        <Calculator className='size-4' />
        {title ?? 'Worked example'}
      </p>
      <div className='[&_p]:leading-relaxed [&_p:last-child]:mb-0'>{children}</div>
    </div>
  )
}
