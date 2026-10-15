import { cn } from '@/lib/utils'

interface CompactFieldProps {
  label: string
  children: React.ReactNode
  required?: boolean
  hint?: string
  /** Zod/React Hook Form validation error for this field (AUD-044). Shown
   * in place of `hint` when present. */
  error?: string
  className?: string
}

/** A dense label+control pair for data-heavy setup forms (School Setup and
 * onward) -- small text, tight spacing, meant to be laid out in a 2-4
 * column grid so dozens of fields fit without endless scrolling. Distinct
 * from the regular <Label>/<FormLabel> pattern used on the lighter,
 * few-field forms elsewhere (sign-in, Account Settings), which stay as-is. */
export function CompactField({ label, children, required, hint, error, className }: CompactFieldProps) {
  return (
    <div className={cn('grid gap-1', className)}>
      <label className='text-xs font-medium text-muted-foreground'>
        {label}
        {required && <span className='text-destructive'> *</span>}
      </label>
      {children}
      {error ? (
        <p className='text-[11px] text-destructive'>{error}</p>
      ) : (
        hint && <p className='text-[11px] text-muted-foreground'>{hint}</p>
      )}
    </div>
  )
}

/** Shared compact input/select sizing -- h-8 + text-sm instead of the
 * default h-9 + text-base, so these dense forms don't waste vertical
 * space on padding meant for a handful-of-fields form. */
export const compactControlClass = 'h-8 text-sm'
