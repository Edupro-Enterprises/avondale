import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
      <div className='flex h-12 w-12 items-center justify-center rounded-full bg-muted'>
        <Icon className='h-5 w-5 text-muted-foreground' />
      </div>
      <div className='space-y-1'>
        <p className='text-sm font-medium'>{title}</p>
        {description && (
          <p className='text-xs text-muted-foreground'>{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button variant='outline' size='sm' onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
