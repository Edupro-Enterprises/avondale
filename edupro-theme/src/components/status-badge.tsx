import { cn } from '@/lib/utils'

export type StatusTone = 'good' | 'warning' | 'bad' | 'neutral' | 'info'

const toneClass: Record<StatusTone, string> = {
  good: 'bg-status-good-bg text-status-good',
  warning: 'bg-status-warning-bg text-status-warning',
  bad: 'bg-status-bad-bg text-status-bad',
  neutral: 'bg-status-neutral-bg text-status-neutral',
  info: 'bg-status-info-bg text-status-info',
}

/** The status color language every list page shares: good=green,
 * warning=amber, bad=red, neutral=slate, info=blue. Each page maps its own
 * status enum to a tone -- this component only renders the chip. Colors
 * come from the --status-* tokens in theme.css, each verified to clear
 * WCAG AA against its own chip background in both light and dark mode. */
export function StatusBadge({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', toneClass[tone], className)}>
      {children}
    </span>
  )
}
