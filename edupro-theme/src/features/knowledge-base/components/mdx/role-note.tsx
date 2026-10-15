import type { ReactNode } from 'react'
import { UserRound } from 'lucide-react'
import type { KbAudienceTag } from '@/features/knowledge-base/types/kb'

/** Flags a passage as relevant to one specific persona within an
 * otherwise general article -- distinct from Callout (which flags
 * severity/tone, not audience). */
export function RoleNote({ role, children }: { role: KbAudienceTag; children: ReactNode }) {
  return (
    <div className='my-4 flex gap-3 rounded-lg border border-dashed px-4 py-3 text-sm'>
      <UserRound className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
      <div className='space-y-1 [&_p]:leading-relaxed [&_p:last-child]:mb-0'>
        <p className='font-semibold capitalize'>For {role}</p>
        {children}
      </div>
    </div>
  )
}
