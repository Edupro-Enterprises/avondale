import { cn } from '@/lib/utils'

/** Shared uppercase section-label style (AUD-003) -- was hand-typed at
 * every call site with no shared source of truth. */
export function SectionLabel({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      className={cn('mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase', className)}
      {...props}
    />
  )
}
