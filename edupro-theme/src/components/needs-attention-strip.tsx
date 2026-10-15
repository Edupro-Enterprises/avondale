import { Link } from '@tanstack/react-router'
import { CheckCircle2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileRouteTypes } from '@/routeTree.gen'

export interface AttentionItem {
  label: string
  count: number
  description: string
  icon: LucideIcon
  to: FileRouteTypes['to']
  tone: 'bad' | 'warning'
}

const toneBadgeClass: Record<AttentionItem['tone'], string> = {
  bad: 'bg-status-bad-bg text-status-bad',
  warning: 'bg-status-warning-bg text-status-warning',
}

const toneCountClass: Record<AttentionItem['tone'], string> = {
  bad: 'text-status-bad',
  warning: 'text-status-warning',
}

/** AUD-018: a priority strip above the standard KPI grid, surfacing what
 * actually needs the viewer's action today instead of burying it at the
 * same visual weight as passive metrics. Only items with count > 0 render;
 * an all-clear note replaces the strip when nothing needs attention. */
export function NeedsAttentionStrip({ items }: { items: AttentionItem[] }) {
  const active = items.filter((item) => item.count > 0)

  if (active.length === 0) {
    return (
      <div className='mb-6 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm'>
        <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-good-bg text-status-good'>
          <CheckCircle2 className='h-4 w-4' />
        </span>
        Nothing needs your attention today.
      </div>
    )
  }

  return (
    <div className='mb-6 grid gap-3 sm:grid-cols-2'>
      {active.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          className='flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/50'
        >
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', toneBadgeClass[item.tone])}>
            <item.icon className='h-4 w-4' />
          </span>
          <div className='min-w-0'>
            <div className='flex items-baseline gap-2'>
              <span className={cn('text-2xl font-bold tabular-nums', toneCountClass[item.tone])}>{item.count}</span>
              <span className='text-sm font-medium'>{item.label}</span>
            </div>
            <p className='truncate text-xs text-muted-foreground'>{item.description}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
