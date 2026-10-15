import { Children, type ReactNode } from 'react'

export function Steps({ children }: { children: ReactNode }) {
  const items = Children.toArray(children)
  return (
    <ol className='my-4 list-none space-y-4 border-l pl-6'>
      {items.map((child, i) => (
        <li key={i} className='relative'>
          <span className='absolute -left-[calc(1.5rem+0.5px)] flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground'>
            {i + 1}
          </span>
          {child}
        </li>
      ))}
    </ol>
  )
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className='pl-2'>
      <p className='font-semibold'>{title}</p>
      <div className='mt-1 text-sm text-muted-foreground [&_p]:leading-relaxed'>{children}</div>
    </div>
  )
}
