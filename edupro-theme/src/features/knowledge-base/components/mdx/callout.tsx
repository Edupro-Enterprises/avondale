import type { ReactNode } from 'react'
import { Info, AlertTriangle, Lightbulb, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

const VARIANTS = {
  info: { icon: Info, className: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100' },
  tip: { icon: Lightbulb, className: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' },
  warning: { icon: AlertTriangle, className: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100' },
  danger: { icon: ShieldAlert, className: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100' },
} as const

export function Callout({
  variant = 'info',
  title,
  children,
}: {
  variant?: keyof typeof VARIANTS
  title?: string
  children: ReactNode
}) {
  const { icon: Icon, className } = VARIANTS[variant]
  return (
    <div role='note' className={cn('my-4 flex gap-3 rounded-lg border px-4 py-3 text-sm', className)}>
      <Icon className='mt-0.5 size-4 shrink-0' />
      <div className='space-y-1 [&_p]:leading-relaxed [&_p:last-child]:mb-0'>
        {title && <p className='font-semibold'>{title}</p>}
        {children}
      </div>
    </div>
  )
}
