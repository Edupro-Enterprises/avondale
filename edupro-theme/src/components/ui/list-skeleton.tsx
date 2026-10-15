import { Skeleton } from '@/components/ui/skeleton'

interface ListSkeletonProps {
  rows?: number
}

export function ListSkeleton({ rows = 4 }: ListSkeletonProps) {
  return (
    <div className='divide-y'>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className='flex items-center justify-between gap-4 py-4'>
          <div className='flex flex-1 items-center gap-3'>
            <Skeleton className='h-10 w-10 shrink-0 rounded-full' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-3.5 w-1/3' />
              <Skeleton className='h-3 w-1/2' />
            </div>
          </div>
          <div className='flex items-center gap-4'>
            <div className='space-y-2 text-right'>
              <Skeleton className='ms-auto h-3.5 w-14' />
              <Skeleton className='ms-auto h-3 w-10' />
            </div>
            <Skeleton className='h-8 w-8 rounded-md' />
          </div>
        </div>
      ))}
    </div>
  )
}
