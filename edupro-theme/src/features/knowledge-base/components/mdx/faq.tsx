import { type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export function Faq({ children }: { children: ReactNode }) {
  return <div className='my-4 divide-y rounded-lg border'>{children}</div>
}

export function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  return (
    <Collapsible className='group/faq'>
      <CollapsibleTrigger className='flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium'>
        {question}
        <ChevronRight className='size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/faq:rotate-90' />
      </CollapsibleTrigger>
      <CollapsibleContent className='px-4 pb-3 text-sm text-muted-foreground [&_p]:leading-relaxed'>
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
